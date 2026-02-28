const fs = require('fs');

// 1. Revert worker.js backend bypass
const workerJs = 'routes/worker.js';
let wContent = fs.readFileSync(workerJs, 'utf8');

const bypassStart = wContent.indexOf("// Fast-track bypass for React Native app which skips estimate phase");
if (bypassStart !== -1) {
    const bypassEnd = wContent.indexOf("return { verified: true, bypass: true };\n        }");
    if (bypassEnd !== -1) {
        const bypassBlock = wContent.substring(bypassStart, bypassEnd + "return { verified: true, bypass: true };\n        }".length);
        wContent = wContent.replace(bypassBlock, "");
        fs.writeFileSync(workerJs, wContent, 'utf8');
    }
}

// 2. Add inspection flow to ActiveJobScreen.jsx
const screenJs = 'zarva-mobile/src/screens/worker/ActiveJobScreen.jsx';
let sContent = fs.readFileSync(screenJs, 'utf8');

// Add states
if (!sContent.includes("const [inspectionOtp")) {
    sContent = sContent.replace(
        "const [startOtp, setStartOtp] = useState(['', '', '', '']);",
        "const [startOtp, setStartOtp] = useState(['', '', '', '']);\n    const [inspectionOtp, setInspectionOtp] = useState(['', '', '', '']);\n    const [estimatedMinutes, setEstimatedMinutes] = useState('60');\n    const [estimateNotes, setEstimateNotes] = useState('');"
    );
}

// Add Handler functions
if (!sContent.includes("handleVerifyInspectionOtp")) {
    const newHandlers = 
    const handleVerifyInspectionOtp = async () => {
        const code = inspectionOtp.join('');
        if (code.length !== 4) return;
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        try {
            await apiClient.post(\/api/worker/jobs/\/verify-inspection-otp\, { code });
            setStatus('inspection_active');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Invalid Code', err.response?.data?.message || 'Incorrect service code.');
            setInspectionOtp(['', '', '', '']);
        } finally {
            setActionLoading(false);
        }
    };

    const handleSubmitEstimate = async () => {
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await apiClient.post(\/api/worker/jobs/\/inspection/estimate\, {
                estimated_minutes: parseInt(estimatedMinutes) || 60,
                notes: estimateNotes
            });
            setStatus('estimate_submitted');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to submit estimate.');
        } finally {
            setActionLoading(false);
        }
    };
    ;
    sContent = sContent.replace("const handleVerifyStartOtp", newHandlers + "\n    const handleVerifyStartOtp");
}

// Update Render
if (!sContent.includes("if (status === 'inspection_active')")) {
    const isArrivedBlockOld = \        if (isArrived) {
            return (
                <FadeInView delay={200} style={styles.actionSection}>
                    <Card style={styles.actionCard}>
                        <Text style={styles.actionLabel}>{t('authentication')}</Text>
                        <Text style={styles.actionTitle}>{t('enter_start_code')}</Text>
                        <Text style={styles.actionSub}>{t('enter_start_code_desc')}</Text>
                        <View style={styles.otpWrap}>
                            <OTPInput
                                disabled={actionLoading}
                                onChange={(code) => setStartOtp(code.split('').concat(Array(4).fill('')).slice(0, 4))}
                            />
                        </View>
                        <PremiumButton
                            title={t('start_billable_session')}
                            onPress={handleVerifyStartOtp}
                            loading={actionLoading}
                            disabled={startOtp.join('').length < 4}
                        />
                        {otpExpirySeconds !== null && (
                            <Text style={styles.expiryTxt}>{t('code_expires_in')}{formatTime(otpExpirySeconds)}</Text>
                        )}
                    </Card>
                </FadeInView>
            );
        }\;
        
    const isArrivedBlockNew = \
        if (isArrived) {
            return (
                <FadeInView delay={200} style={styles.actionSection}>
                    <Card style={styles.actionCard}>
                        <Text style={styles.actionLabel}>Arrival Confirmation</Text>
                        <Text style={styles.actionTitle}>Enter Service Code</Text>
                        <Text style={styles.actionSub}>Ask customer for the 4-digit service code to confirm you have arrived.</Text>
                        <View style={styles.otpWrap}>
                            <OTPInput
                                disabled={actionLoading}
                                onChange={(code) => setInspectionOtp(code.split('').concat(Array(4).fill('')).slice(0, 4))}
                            />
                        </View>
                        <PremiumButton
                            title={"Verify & Start Inspection"}
                            onPress={handleVerifyInspectionOtp}
                            loading={actionLoading}
                            disabled={inspectionOtp.join('').length < 4}
                        />
                    </Card>
                </FadeInView>
            );
        }

        if (status === 'inspection_active') {
             return (
                 <FadeInView delay={200} style={styles.actionSection}>
                     <Card style={styles.actionCard}>
                         <Text style={styles.actionLabel}>Inspection</Text>
                         <Text style={styles.actionTitle}>Submit Estimate</Text>
                         <Text style={styles.actionSub}>Estimate the duration and add any notes.</Text>
                         
                         <View style={{ marginTop: 16 }}>
                             <Text style={{ color: tTheme.text.secondary, fontSize: 12, marginBottom: 8 }}>Estimated Duration (Minutes)</Text>
                             <TextInput
                                 style={{ backgroundColor: tTheme.background.surfaceRaised, color: tTheme.text.primary, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tTheme.border.default }}
                                 value={estimatedMinutes}
                                 onChangeText={setEstimatedMinutes}
                                 keyboardType="number-pad"
                             />
                         </View>

                         <View style={{ marginTop: 16 }}>
                             <Text style={{ color: tTheme.text.secondary, fontSize: 12, marginBottom: 8 }}>Inspection Notes (Optional)</Text>
                             <TextInput
                                 style={{ backgroundColor: tTheme.background.surfaceRaised, color: tTheme.text.primary, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: tTheme.border.default, minHeight: 80 }}
                                 value={estimateNotes}
                                 onChangeText={setEstimateNotes}
                                 multiline
                                 placeholderTextColor={tTheme.text.tertiary}
                                 placeholder="e.g. Needs replacement parts"
                             />
                         </View>

                         <View style={{ marginTop: 24 }}>
                            <PremiumButton
                                title={"Submit Estimate"}
                                onPress={handleSubmitEstimate}
                                loading={actionLoading}
                            />
                        </View>
                     </Card>
                 </FadeInView>
             );
        }

        if (status === 'estimate_submitted') {
             return (
                <FadeInView delay={200} style={styles.actionSection}>
                    <Card style={styles.actionCard}>
                        <Text style={styles.actionLabel}>{t('authentication')}</Text>
                        <Text style={styles.actionTitle}>{t('enter_start_code')}</Text>
                        <Text style={styles.actionSub}>{t('enter_start_code_desc')}</Text>
                        <View style={styles.otpWrap}>
                            <OTPInput
                                disabled={actionLoading}
                                onChange={(code) => setStartOtp(code.split('').concat(Array(4).fill('')).slice(0, 4))}
                            />
                        </View>
                        <PremiumButton
                            title={t('start_billable_session')}
                            onPress={handleVerifyStartOtp}
                            loading={actionLoading}
                            disabled={startOtp.join('').length < 4}
                        />
                        {otpExpirySeconds !== null && (
                            <Text style={styles.expiryTxt}>{t('code_expires_in')}{formatTime(otpExpirySeconds)}</Text>
                        )}
                    </Card>
                </FadeInView>
            );
        }
\;

    // Because the string might not match exactly due to indentation, we use regex
    const regex = /if \\(isArrived\\) \\{[\\s\\S]*?<PremiumButton[\\s\\S]*?title=\\{t\\('start_billable_session'\\)\\}[\\s\\S]*?\\/>[\\s\\S]*?<\\/FadeInView>[\\s\\S]*?\\}/;
    sContent = sContent.replace(regex, isArrivedBlockNew);
}

// Ensure TextInput is imported
if (!sContent.includes("TextInput")) {
    sContent = sContent.replace("import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';", "import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking, TextInput } from 'react-native';");
}

fs.writeFileSync(screenJs, sContent, 'utf8');
console.log('Inspection script completed');
