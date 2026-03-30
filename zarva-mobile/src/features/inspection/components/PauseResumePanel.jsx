import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { useTokens } from '@shared/design-system';

export default function PauseResumePanel({ 
    status, 
    actionOtp, 
    onPauseRequest, 
    onResumeRequest, 
    loading 
}) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const [reason, setReason] = useState('');
    const [showInput, setShowInput] = useState(false);

    if (!['in_progress', 'pause_requested', 'work_paused', 'resume_requested'].includes(status)) {
        return null;
    }

    const handlePauseSubmit = () => {
        if (!reason.trim()) return;
        onPauseRequest(reason);
        setShowInput(false);
        setReason('');
    };

    return (
        <View style={styles.container}>
            {/* In Progress -> Request Pause */}
            {status === 'in_progress' && (
                <>
                    {!showInput ? (
                        <TouchableOpacity style={styles.btnWarning} onPress={() => setShowInput(true)}>
                            <Text style={styles.btnWarningTxt}>⏸ Request Session Pause</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.inputContainer}>
                            <Text style={styles.label}>Reason for pausing:</Text>
                            <TextInput 
                                style={styles.input}
                                placeholder="e.g., Buying missing materials..."
                                placeholderTextColor={tTheme.text.tertiary}
                                value={reason}
                                onChangeText={setReason}
                                autoFocus
                            />
                            <View style={styles.row}>
                                <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowInput(false)}>
                                    <Text style={styles.cancelBtnTxt}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    style={[styles.submitBtn, (!reason.trim() || loading) && styles.disabledBtn]} 
                                    onPress={handlePauseSubmit}
                                    disabled={!reason.trim() || loading}
                                >
                                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitBtnTxt}>Submit</Text>}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </>
            )}

            {/* Pause Requested -> Show OTP */}
            {status === 'pause_requested' && (
                <View style={styles.otpBox}>
                    <Text style={styles.otpTitle}>Pause Requested</Text>
                    <Text style={styles.otpSub}>Ask the customer to enter this code on their phone to approve the pause:</Text>
                    <Text style={styles.otpVal}>{actionOtp || '----'}</Text>
                </View>
            )}

            {/* Work Paused -> Request Resume */}
            {status === 'work_paused' && (
                <TouchableOpacity 
                    style={styles.btnSuccess} 
                    onPress={onResumeRequest}
                    disabled={loading}
                >
                    {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnSuccessTxt}>▶ Request Resume</Text>}
                </TouchableOpacity>
            )}

            {/* Resume Requested -> Show OTP */}
            {status === 'resume_requested' && (
                <View style={styles.otpBox}>
                    <Text style={[styles.otpTitle, { color: tTheme.status.success.base }]}>Resume Requested</Text>
                    <Text style={styles.otpSub}>Ask the customer to enter this code to restart the timer:</Text>
                    <Text style={[styles.otpVal, { color: tTheme.status.success.base }]}>{actionOtp || '----'}</Text>
                </View>
            )}
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    container: { marginVertical: 12 },
    btnWarning: { backgroundColor: t.status.warning.base + '15', borderWidth: 1, borderColor: t.status.warning.base + '55', padding: 16, borderRadius: 14, alignItems: 'center' },
    btnWarningTxt: { color: t.status.warning.base, fontSize: 16, fontWeight: '800' },
    btnSuccess: { backgroundColor: t.status.success.base + '15', borderWidth: 1, borderColor: t.status.success.base + '55', padding: 16, borderRadius: 14, alignItems: 'center' },
    btnSuccessTxt: { color: t.status.success.base, fontSize: 16, fontWeight: '800' },
    inputContainer: { backgroundColor: t.background.surfaceRaised, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: t.border.default },
    label: { color: t.text.secondary, fontSize: 12, fontWeight: '700', marginBottom: 8 },
    input: { backgroundColor: t.background.app, color: t.text.primary, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: t.border.default, marginBottom: 12 },
    row: { flexDirection: 'row', gap: 12 },
    cancelBtn: { flex: 1, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: t.border.default, alignItems: 'center' },
    cancelBtnTxt: { color: t.text.secondary, fontWeight: '700' },
    submitBtn: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: t.status.warning.base, alignItems: 'center' },
    submitBtnTxt: { color: '#fff', fontWeight: '800' },
    disabledBtn: { opacity: 0.5 },
    otpBox: { backgroundColor: t.brand.primary + '11', padding: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: t.brand.primary + '44' },
    otpTitle: { color: t.brand.primary, fontSize: 16, fontWeight: '900', marginBottom: 4 },
    otpSub: { color: t.text.secondary, fontSize: 12, textAlign: 'center', marginBottom: 12 },
    otpVal: { fontSize: 36, fontWeight: '900', color: t.brand.primary, letterSpacing: 6 },
});
