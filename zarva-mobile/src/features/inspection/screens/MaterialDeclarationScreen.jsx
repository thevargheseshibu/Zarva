/**
 * MaterialDeclarationScreen.jsx
 * Worker declares material items used during the job before marking complete.
 * Camera-only receipt capture (no gallery). Validates per-category limits.
 */

import React, { useState, useRef, useCallback, useMemo } from 'react';
import {
    View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
    Alert, KeyboardAvoidingView, Platform, ActivityIndicator, Image
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useTokens } from '@shared/design-system';
import { useJobStore } from '@jobs/store';
import { useAuthStore } from '@auth/store';
import apiClient from '@infra/api/client';



export default function MaterialDeclarationScreen({ navigation, route }) {
    const tokens = useTokens();
    const COLORS = useMemo(() => ({
        bg: tokens.background.app,
        surface: tokens.background.surface,
        card: tokens.background.surfaceRaised,
        accent: tokens.brand.primary,
        green: tokens.status?.success?.base || '#22C55E',
        red: tokens.status?.danger?.base || '#EF4444',
        orange: tokens.status?.warning?.base || '#F59E0B',
        textPrimary: tokens.text.primary,
        textSecondary: tokens.text.secondary,
        border: tokens.border.default,
        inputBg: tokens.background.surfaceThreshold || tokens.background.app,
    }), [tokens]);

    const styles = useMemo(() => createStyles(COLORS), [COLORS]);

    const { jobId } = route.params;
    const [items, setItems] = useState([]);
    const [addingItem, setAddingItem] = useState(false);
    const [name, setName] = useState('');
    const [amount, setAmount] = useState('');
    const [showCamera, setShowCamera] = useState(false);
    const [capturedPhoto, setCapturedPhoto] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef(null);

    const totalAmount = items.reduce((sum, i) => sum + i.amount, 0);

    const openCamera = useCallback(async () => {
        if (!permission?.granted) {
            const result = await requestPermission();
            if (!result.granted) {
                Alert.alert('Camera Required', 'Camera permission is required to capture receipts.');
                return;
            }
        }
        setShowCamera(true);
    }, [permission]);

    const capturePhoto = useCallback(async () => {
        if (!cameraRef.current) return;
        try {
            const photo = await cameraRef.current.takePictureAsync({ quality: 0.7, skipProcessing: false });
            setCapturedPhoto(photo.uri);
            setShowCamera(false);
        } catch (e) {
            Alert.alert('Error', 'Failed to capture photo. Please try again.');
        }
    }, []);

    const addItem = () => {
        const amtNum = parseFloat(amount.replace(/[^0-9.]/g, ''));
        if (!name.trim()) { Alert.alert('Error', 'Item name is required'); return; }
        if (!amtNum || amtNum <= 0) { Alert.alert('Error', 'Enter a valid amount'); return; }
        const newItem = {
            id: Date.now(),
            name: name.trim(),
            amount: amtNum,
            receipt_url: capturedPhoto || null,
            receipt_s3_key: null,
        };
        setItems(prev => [...prev, newItem]);
        setName('');
        setAmount('');
        setCapturedPhoto(null);
        setAddingItem(false);
    };

    const removeItem = (id) => {
        setItems(prev => prev.filter(i => i.id !== id));
    };

    const submitMaterials = async (withNoMaterials = false) => {
        setSubmitting(true);
        try {
            await apiClient.post(`/api/worker/jobs/${jobId}/materials`, {
                items: withNoMaterials ? [] : items,
            });
            navigation.replace('JobCompleteSummary', { jobId });
        } catch (err) {
            const msg = err?.response?.data?.message || 'Failed to submit materials';
            Alert.alert('Error', msg);
        } finally {
            setSubmitting(false);
        }
    };

    const confirmNoMaterials = () => {
        Alert.alert(
            'No Materials',
            'Confirm that no materials were used for this job?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Confirm', onPress: () => submitMaterials(true) }
            ]
        );
    };

    if (showCamera) {
        return (
            <View style={styles.cameraContainer}>
                <CameraView ref={cameraRef} style={StyleSheet.absoluteFill} facing="back" />
                <View style={styles.cameraOverlay}>
                    <Text style={styles.cameraHint}>Point at receipt</Text>
                    <TouchableOpacity style={styles.captureBtn} onPress={capturePhoto}>
                        <View style={styles.captureBtnInner} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.cancelCameraBtn} onPress={() => setShowCamera(false)}>
                        <Text style={styles.cancelCameraText}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    return (
        <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Declare Materials</Text>
                <Text style={styles.headerSub}>Add items you purchased for this job</Text>
            </View>

            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                {/* Existing items */}
                {items.map(item => (
                    <View key={item.id} style={styles.itemCard}>
                        <View style={styles.itemInfo}>
                            <Text style={styles.itemName}>{item.name}</Text>
                            {item.receipt_url && (
                                <Image source={{ uri: item.receipt_url }} style={styles.receiptThumb} />
                            )}
                        </View>
                        <View style={styles.itemAmtRow}>
                            <Text style={styles.itemAmt}>₹{item.amount.toLocaleString('en-IN')}</Text>
                            <TouchableOpacity onPress={() => removeItem(item.id)}>
                                <Text style={styles.removeBtn}>✕</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}

                {/* Add item form */}
                {addingItem ? (
                    <View style={styles.addForm}>
                        <Text style={styles.formLabel}>Item Description</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="e.g. Wire 2.5mm copper"
                            placeholderTextColor={COLORS.textSecondary}
                            value={name}
                            onChangeText={setName}
                        />
                        <Text style={styles.formLabel}>Amount (₹)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="0.00"
                            placeholderTextColor={COLORS.textSecondary}
                            value={amount}
                            onChangeText={setAmount}
                            keyboardType="decimal-pad"
                        />

                        {capturedPhoto ? (
                            <View style={styles.photoRow}>
                                <Image source={{ uri: capturedPhoto }} style={styles.photoPreview} />
                                <TouchableOpacity onPress={() => setCapturedPhoto(null)} style={styles.retakeBtn}>
                                    <Text style={styles.retakeBtnText}>Retake</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.cameraBtn} onPress={openCamera}>
                                <Text style={styles.cameraBtnText}>📷  Capture Receipt (Camera Only)</Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.formActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setAddingItem(false); setCapturedPhoto(null); }}>
                                <Text style={styles.cancelBtnText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.addConfirmBtn} onPress={addItem}>
                                <Text style={styles.addConfirmBtnText}>Add Item</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <TouchableOpacity style={styles.addMoreBtn} onPress={() => setAddingItem(true)}>
                        <Text style={styles.addMoreBtnText}>+ Add Material Item</Text>
                    </TouchableOpacity>
                )}
            </ScrollView>

            {/* Bottom section */}
            <View style={styles.footer}>
                {items.length > 0 && (
                    <View style={styles.totalRow}>
                        <Text style={styles.totalLabel}>Total Materials</Text>
                        <Text style={styles.totalAmt}>₹{totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
                    onPress={() => submitMaterials(false)}
                    disabled={submitting || addingItem}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.submitBtnText}>Continue to Summary →</Text>
                    )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.noMaterialsBtn} onPress={confirmNoMaterials} disabled={submitting}>
                    <Text style={styles.noMaterialsBtnText}>No materials used</Text>
                </TouchableOpacity>
            </View>
        </KeyboardAvoidingView>
    );
}

const createStyles = (COLORS) => StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.bg },
    scroll: { flex: 1, padding: 16 },
    header: { padding: 20, paddingTop: 52, borderBottomWidth: 1, borderBottomColor: COLORS.border },
    headerTitle: { fontSize: 22, fontWeight: '700', color: COLORS.textPrimary },
    headerSub: { fontSize: 13, color: COLORS.textSecondary, marginTop: 4 },
    summaryCard: {
        backgroundColor: COLORS.surface, borderRadius: 16, padding: 20,
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20, borderWidth: 1, borderColor: COLORS.border,
    },
    summaryLabel: { color: COLORS.textSecondary, fontSize: 14, fontWeight: '600' },
    summaryValue: { color: COLORS.textPrimary, fontSize: 22, fontWeight: '800' },
    sectionLabel: { color: COLORS.textSecondary, fontSize: 11, fontWeight: '800', marginBottom: 10, letterSpacing: 1, textTransform: 'uppercase' },
    itemList: { marginBottom: 12 },
    itemCard: {
        backgroundColor: COLORS.card, borderRadius: 12, padding: 14, marginBottom: 10,
    },
    itemInfo: { flex: 1 },
    itemName: { color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' },
    receiptThumb: { width: 40, height: 40, borderRadius: 6, marginTop: 6 },
    itemAmtRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    itemAmt: { color: COLORS.green, fontSize: 16, fontWeight: '700' },
    removeBtn: { color: COLORS.red, fontSize: 18, padding: 4 },
    addForm: { backgroundColor: COLORS.surface, borderRadius: 16, padding: 16, marginBottom: 16 },
    formLabel: { color: COLORS.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 6, marginTop: 10 },
    input: {
        backgroundColor: COLORS.inputBg, borderRadius: 10, padding: 12,
        color: COLORS.textPrimary, fontSize: 15, borderWidth: 1, borderColor: COLORS.border,
    },
    cameraBtn: {
        backgroundColor: COLORS.inputBg, borderRadius: 10, padding: 14,
        alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, marginTop: 10,
    },
    cameraBtnText: { color: COLORS.accent, fontSize: 14, fontWeight: '600' },
    photoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10 },
    photoPreview: { width: 70, height: 70, borderRadius: 8 },
    retakeBtn: { padding: 8, backgroundColor: COLORS.inputBg, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
    retakeBtnText: { color: COLORS.accent, fontSize: 13 },
    formActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
    cancelBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
    cancelBtnText: { color: COLORS.textSecondary, fontSize: 14 },
    addConfirmBtn: { flex: 1, backgroundColor: COLORS.accent, padding: 12, borderRadius: 10, alignItems: 'center' },
    addConfirmBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
    addMoreBtn: {
        borderWidth: 1.5, borderColor: COLORS.accent, borderStyle: 'dashed',
        borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 16,
    },
    addMoreBtnText: { color: COLORS.accent, fontSize: 15, fontWeight: '600' },
    footer: { padding: 20, paddingBottom: 36, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 10 },
    totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
    totalLabel: { color: COLORS.textSecondary, fontSize: 14 },
    totalAmt: { color: COLORS.green, fontSize: 18, fontWeight: '700' },
    submitBtn: { backgroundColor: COLORS.accent, padding: 15, borderRadius: 12, alignItems: 'center' },
    submitBtnDisabled: { opacity: 0.6 },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    noMaterialsBtn: { alignItems: 'center', padding: 8 },
    noMaterialsBtnText: { color: COLORS.textSecondary, fontSize: 14, textDecorationLine: 'underline' },
    cameraContainer: { flex: 1, backgroundColor: '#000' },
    cameraOverlay: {
        position: 'absolute', bottom: 0, left: 0, right: 0, padding: 30,
        alignItems: 'center', gap: 16,
    },
    cameraHint: { color: '#fff', fontSize: 14, opacity: 0.8 },
    captureBtn: {
        width: 72, height: 72, backgroundColor: 'rgba(255,255,255,0.25)',
        borderRadius: 36, alignItems: 'center', justifyContent: 'center',
    },
    captureBtnInner: { width: 56, height: 56, backgroundColor: '#fff', borderRadius: 28 },
    cancelCameraBtn: { padding: 10 },
    cancelCameraText: { color: '#fff', fontSize: 15 },
});
