import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking, Platform, Modal } from 'react-native';
import { WebView } from 'react-native-webview'; 
import * as Haptics from 'expo-haptics';
import { useT } from '@shared/i18n/useTranslation';
import apiClient from '@infra/api/client';
import FadeInView from '@shared/ui/FadeInView';
import PremiumButton from '@shared/ui/PremiumButton';
import Card from '@shared/ui/ZCard';
import PremiumHeader from '@shared/ui/PremiumHeader';
import MainBackground from '@shared/ui/MainBackground';

export default function PaymentScreen({ route, navigation }) {
    const tTheme = useTokens();
    const styles = useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    const { jobId } = route.params || { jobId: 'mock-123' };
    
    const [loading, setLoading] = useState(false);
    const [invoice, setInvoice] = useState(null);
    const [fetchingInvoice, setFetchingInvoice] = useState(true);
    
    // ⭐ Gateway States
    const [showGateway, setShowGateway] = useState(false);
    const [checkoutHTML, setCheckoutHTML] = useState('');

    // ⭐ Secure Polling States
    const [pollingOrderId, setPollingOrderId] = useState(null);
    const [pollTimeLeft, setPollTimeLeft] = useState(0);

    useEffect(() => {
        apiClient.get(`/api/payment/invoice/${jobId}`)
            .then(res => setInvoice(res.data?.data))
            .catch(err => {
                Alert.alert('Error', 'Unable to fetch invoice details.');
                console.error(err);
            })
            .finally(() => setFetchingInvoice(false));
    }, [jobId]);

    // ⭐ Polling Effect (Checks DB for Webhook Confirmation)
    useEffect(() => {
        let interval;
        if (pollingOrderId && pollTimeLeft > 0) {
            interval = setInterval(async () => {
                try {
                    const res = await apiClient.get(`/api/payment/status/${pollingOrderId}`);
                    const dbStatus = res.data?.data?.status;

                    if (dbStatus === 'captured') {
                        clearInterval(interval);
                        setPollingOrderId(null);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        Alert.alert('Payment Verified', 'Bank confirmation received securely.');
                        navigation.replace('Rating', { jobId });
                    } else if (dbStatus === 'failed') {
                        clearInterval(interval);
                        setPollingOrderId(null);
                        Alert.alert('Payment Failed', 'The bank declined or failed the transaction.');
                    } else {
                        // Tick down 3 seconds
                        setPollTimeLeft(prev => Math.max(0, prev - 3));
                    }
                } catch (err) {
                    console.error('Polling check failed', err);
                }
            }, 3000); // Check every 3 seconds
        } else if (pollingOrderId && pollTimeLeft <= 0) {
            // Timeout reached
            setPollingOrderId(null);
            Alert.alert(
                'Payment Pending', 
                'We have not received final confirmation from your bank yet. We will automatically update your job status once the confirmation arrives.'
            );
            navigation.replace('CustomerTabs'); // Return to home
        }

        return () => clearInterval(interval);
    }, [pollingOrderId, pollTimeLeft, jobId, navigation]);

    const generateRazorpayHTML = (orderData) => `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <script src="https://checkout.razorpay.com/v1/checkout.js"></script>
        </head>
        <body style="background-color: #121212; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
            <p style="color: #6F5BDD; font-family: sans-serif;">Initializing Secure Gateway...</p>
            <script>
                var options = {
                    key: "${orderData.key_id}",
                    amount: "${Math.round(orderData.amount * 100)}", 
                    currency: "INR",
                    name: "ZARVA Services",
                    description: "Payment for Job #${jobId}",
                    order_id: "${orderData.order_id}",
                    theme: { color: "#6F5BDD" },
                    handler: function(response) {
                        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "SUCCESS", data: response }));
                    },
                    modal: {
                        ondismiss: function() {
                            window.ReactNativeWebView.postMessage(JSON.stringify({ type: "CANCELLED" }));
                        }
                    }
                };
                var rzp = new Razorpay(options);
                rzp.on("payment.failed", function(response) {
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "FAILED", data: response.error }));
                });
                rzp.open();
            </script>
        </body>
        </html>
    `;

    const handleDigitalPayment = async () => {
        if (loading) return;
        setLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const res = await apiClient.post('/api/payment/create-order', { 
                job_id: jobId, 
                payment_type: 'final' 
            });
            const html = generateRazorpayHTML(res.data.data);
            setCheckoutHTML(html);
            setShowGateway(true);
        } catch (err) {
            console.error(err);
            Alert.alert('Payment Error', 'Could not initialize payment gateway.');
        } finally {
            setLoading(false);
        }
    };

    const onGatewayMessage = async (event) => {
        let message;
        try {
            message = JSON.parse(event.nativeEvent.data);
        } catch {
            return;
        }
        
        if (message.type === "CANCELLED") {
            setShowGateway(false);
            Alert.alert("Cancelled", "Payment was cancelled.");
            return;
        }

        if (message.type === "FAILED") {
            setShowGateway(false);
            Alert.alert("Failed", message.data?.description || "Payment failed.");
            return;
        }

        if (message.type === "SUCCESS") {
            setShowGateway(false);
            
            // 1. Send the signature verify to backend (Primary check)
            try {
                await apiClient.post('/api/payment/verify', {
                    razorpay_order_id: message.data.razorpay_order_id,
                    razorpay_payment_id: message.data.razorpay_payment_id,
                    razorpay_signature: message.data.razorpay_signature
                });
            } catch (err) {
                console.warn('Frontend verify ping failed, relying on webhook polling.');
            }

            // 2. Start Polling for Webhook confirmation
            setPollingOrderId(message.data.razorpay_order_id);
            setPollTimeLeft(60); 
        }
    };

    const confirmingRef = useRef(false);
    const handleCashPaid = async () => {
        if (loading || confirmingRef.current) return;
        Alert.alert('Confirm Cash', 'I confirm cash has been collected.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Confirm', onPress: async () => {
                confirmingRef.current = true;
                setLoading(true);
                try {
                    await apiClient.post('/api/payment/cash-confirm', { job_id: jobId, payment_type: 'final' });
                    navigation.replace('Rating', { jobId });
                } catch (err) {
                    Alert.alert('Error', 'Failed to confirm cash payment.');
                } finally {
                    setLoading(false);
                    confirmingRef.current = false;
                }
            }}
        ]);
    };

    const handleDownloadInvoicePdf = async () => {
        if (!invoice) return;
        try {
            const url = `${apiClient.defaults.baseURL}/api/payment/invoice/${jobId}/pdf`;
            await Linking.openURL(url);
        } catch (err) {
            Alert.alert('Error', 'Failed to open invoice PDF.');
        }
    };

    // ⭐ Polling Screen Render
    if (pollingOrderId) {
        return (
            <MainBackground>
                <PremiumHeader title="Verifying Payment" onBack={() => {}} />
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={tTheme.brand.primary} />
                    <Text style={styles.pollTitle}>Verifying with Bank</Text>
                    <Text style={styles.pollSub}>Please do not close the app while we secure your confirmation.</Text>
                    <Text style={styles.pollTimer}>Timeout in {pollTimeLeft}s</Text>
                </View>
            </MainBackground>
        );
    }

    if (fetchingInvoice) return <MainBackground><ActivityIndicator size="large" color={tTheme.brand.primary} style={{ flex: 1 }} /></MainBackground>;

    if (showGateway) {
        return (
            <Modal visible={true} animationType="slide">
                <View style={{ flex: 1, backgroundColor: '#121212', paddingTop: Platform.OS === 'ios' ? 50 : 0 }}>
                    <TouchableOpacity onPress={() => setShowGateway(false)} style={{ padding: 16 }}>
                        <Text style={{ color: '#fff' }}>✕ Cancel Checkout</Text>
                    </TouchableOpacity>
                    <WebView
                        source={{ html: checkoutHTML }}
                        onMessage={onGatewayMessage}
                        javaScriptEnabled={true}
                        domStorageEnabled={true}
                        startInLoadingState={true}
                        style={{ flex: 1 }}
                    />
                </View>
            </Modal>
        );
    }

    const { invoice_breakdown: ib } = invoice;

    return (
        <MainBackground>
            <PremiumHeader title={t('secure_checkout')} onBack={() => navigation.replace('CustomerTabs')} />
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                <FadeInView style={styles.introBox}>
                    <View style={styles.checkCircle}><Text style={styles.checkIcon}>✅</Text></View>
                    <Text style={styles.introTitle}>{t('job_complete')}</Text>
                    <Text style={styles.introSub}>{t('review_invoice')}</Text>
                </FadeInView>

                <FadeInView delay={200}>
                    <Card style={styles.invoiceCard}>
                        <View style={styles.invoiceHeader}>
                            <View>
                                <Text style={styles.invoiceLabel}>{t('invoice_no')}</Text>
                                <Text style={styles.invoiceNo}>#{invoice.invoice_number}</Text>
                            </View>
                            <View style={styles.hoursBadge}>
                                <Text style={styles.hoursTxt}>{t('session_hours').replace('%{hours}', invoice.actual_hours)}</Text>
                            </View>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.row}><Text style={styles.label}>{t('labour_cost')}</Text><Text style={styles.value}>₹{ib.base_amount}</Text></View>
                        <View style={styles.row}><Text style={styles.label}>{t('travel_allowance')}</Text><Text style={styles.value}>₹{ib.travel_charge}</Text></View>
                        <View style={styles.row}><Text style={styles.label}>{t('platform_service_fee')}</Text><Text style={styles.value}>₹{ib.platform_fee}</Text></View>

                        <View style={styles.advanceRow}>
                            <View style={styles.advanceInfo}><Text style={styles.advanceLabel}>{t('advance_paid')}</Text><Text style={styles.advanceValue}>- ₹{ib.advance_amount_paid}</Text></View>
                        </View>

                        <View style={styles.totalBlock}>
                            <View><Text style={styles.balanceLabel}>{t('balance_due')}</Text><Text style={styles.totalValue}>₹{ib.balance_due}</Text></View>
                        </View>
                    </Card>
                </FadeInView>

                <View style={styles.footer}>
                    {ib.balance_due > 0 ? (
                        <>
                            <PremiumButton title={t('pay_now').replace('%{amount}', ib.balance_due)} loading={loading} onPress={handleDigitalPayment} />
                            <TouchableOpacity style={styles.cashBtn} onPress={handleCashPaid} disabled={loading}><Text style={styles.cashBtnTxt}>{t('paid_via_cash')}</Text></TouchableOpacity>
                        </>
                    ) : (
                        <PremiumButton title={t('leave_feedback')} onPress={() => navigation.replace('Rating', { jobId })} />
                    )}
                    <TouchableOpacity style={styles.pdfBtn} onPress={handleDownloadInvoicePdf}><Text style={styles.pdfBtnTxt}>{t('download_invoice_pdf')}</Text></TouchableOpacity>
                </View>
            </ScrollView>
        </MainBackground>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 30 },
    pollTitle: { color: '#fff', fontSize: 20, fontWeight: 'bold', marginTop: 20 },
    pollSub: { color: t.text.tertiary, textAlign: 'center', marginTop: 10, lineHeight: 20 },
    pollTimer: { color: t.status.warning.base, fontWeight: 'bold', marginTop: 30 },

    scrollContent: { padding: t.spacing['2xl'], paddingBottom: 60 },
    introBox: { alignItems: 'center', marginBottom: 30 },
    checkCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: t.brand.primary + '11', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.border.default + '44' },
    checkIcon: { fontSize: 24 },
    introTitle: { color: t.text.primary, fontSize: 24, fontWeight: 'bold' },
    introSub: { color: t.text.secondary, fontSize: 14, marginTop: 4 },

    invoiceCard: { padding: t.spacing['2xl'], gap: t.spacing.lg },
    invoiceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    invoiceLabel: { color: t.brand.primary, fontSize: 10, fontWeight: 'bold' },
    invoiceNo: { color: t.text.primary, fontSize: 16, fontWeight: 'bold' },
    hoursBadge: { backgroundColor: t.background.surfaceRaised, padding: 6, borderRadius: 6 },
    hoursTxt: { color: t.text.primary, fontSize: 10, fontWeight: 'bold' },
    divider: { height: 1, backgroundColor: t.background.surface },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    label: { color: t.text.secondary, fontSize: 14 },
    value: { color: t.text.primary, fontSize: 14, fontWeight: 'bold' },
    advanceRow: { backgroundColor: t.background.surface, padding: 12, borderRadius: 8 },
    advanceLabel: { color: t.text.tertiary, fontSize: 10, fontWeight: 'bold' },
    advanceValue: { color: t.brand.primary, fontSize: 16, fontWeight: 'bold' },
    totalBlock: { backgroundColor: t.background.surfaceRaised, padding: 20, borderRadius: 12 },
    balanceLabel: { color: t.brand.primary, fontSize: 10, fontWeight: 'bold' },
    totalValue: { color: t.text.primary, fontSize: 32, fontWeight: 'bold' },

    footer: { marginTop: 30, gap: 16 },
    cashBtn: { padding: 12, alignItems: 'center' },
    cashBtnTxt: { color: t.text.tertiary, textDecorationLine: 'underline' },
    pdfBtn: { padding: 8, alignItems: 'center' },
    pdfBtnTxt: { color: t.text.secondary, textDecorationLine: 'underline' }
});
