import React from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, Animated } from 'react-native';
import PremiumButton from '@shared/ui/PremiumButton';
import OTPInput from '@shared/ui/OTPInput';
import { FadeInView, EndOtpDigits } from './SharedUI';

export function PhaseContent({ 
    styles, tTheme, navigation, jobId, job, status, actionLoading, timeElapsed, formatTime, 
    pulseAnim, handleNavigate, handleCall, handleArrived, handleVerifyInspectionOtp, 
    inspectionOtp, setInspectionOtp, inspectionExpirySeconds, estimateData, setEstimateData, 
    handleSubmitEstimate,
    isInProgress,
    setStopSheetVisible, actionOtp, handleRequestResume, handleMarkComplete, isPending, endOtp, isCompleted, useWorkerStore,
    handleStartTravel, handleAcknowledgeStop, setMaterialModalVisible
}) {
    const isAssigned = status === 'assigned' || status === 'worker_en_route';
    const isArrived = status === 'worker_arrived';
    const isInspection = status === 'inspection_active';
    const isEstimateSubmitted = status === 'estimate_submitted';

    // ── NAVIGATION / ASSIGNED ──────────────────────────────────────────────
    if (isAssigned) return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: '#00E0FF33' }]}>
                <View style={styles.phaseHeader}>
                    <View style={[styles.phaseIconBox, { backgroundColor: '#00E0FF15' }]}>
                        <Text style={{ fontSize: 24 }}>🛵</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.phaseMeta}>MISSION BRIEFING</Text>
                        <Text style={styles.phaseTitle}>Navigate to Client</Text>
                    </View>
                    <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                        <View style={[styles.liveBadge, { backgroundColor: '#00E0FF11', borderColor: '#00E0FF33', borderWidth: 1 }]}>
                            <View style={[styles.liveDot, { backgroundColor: '#00E0FF' }]} />
                            <Text style={[styles.liveTxt, { color: '#00E0FF' }]}>EN ROUTE</Text>
                        </View>
                    </Animated.View>
                </View>

                <View style={styles.addressBox}>
                    <Text style={styles.addressLabel}>📍 SERVICE ADDRESS</Text>
                    <Text style={styles.addressText} numberOfLines={2}>{job?.address || '—'}</Text>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity style={styles.iconActionBtn} onPress={handleNavigate}>
                        <Text style={{ fontSize: 20 }}>🧭</Text>
                        <Text style={styles.iconActionTxt}>Navigate</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.iconActionBtn} onPress={handleCall}>
                        <Text style={{ fontSize: 20 }}>📞</Text>
                        <Text style={styles.iconActionTxt}>Call Client</Text>
                    </TouchableOpacity>
                </View>

                {status === 'assigned' ? (
                    <PremiumButton
                        title="Start Travel to Client"
                        onPress={handleStartTravel}
                        loading={actionLoading}
                        style={{ marginTop: 4 }}
                    />
                ) : (
                    <PremiumButton
                        title="✓ I'm Here — Confirm Arrival"
                        onPress={handleArrived}
                        loading={actionLoading}
                        style={{ marginTop: 4 }}
                    />
                )}
            </View>
        </FadeInView>
    );

    // ── ARRIVED / VERIFICATION ─────────────────────────────────────────────
    if (isArrived) return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: tTheme.brand.primary + '44' }]}>
                <View style={styles.phaseHeader}>
                    <View style={[styles.phaseIconBox, { backgroundColor: tTheme.brand.primary + '15' }]}>
                        <Text style={{ fontSize: 24 }}>🔐</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.phaseMeta}>VERIFICATION PHASE</Text>
                        <Text style={styles.phaseTitle}>Secure Arrival</Text>
                    </View>
                    {inspectionExpirySeconds !== null && (
                        <View style={[styles.countdownBox, { borderColor: tTheme.brand.primary + '44' }]}>
                            <Text style={[styles.countdownVal, { color: tTheme.brand.primary }]}>
                                {formatTime(inspectionExpirySeconds)}
                            </Text>
                            <Text style={styles.countdownLbl}>LEFT</Text>
                        </View>
                    )}
                </View>

                <View style={[styles.instructBanner, { backgroundColor: tTheme.brand.primary + '08', borderColor: tTheme.brand.primary + '22' }]}>
                    <Text style={[styles.instructIcon]}>📱</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.instructTitle, { color: tTheme.brand.primary }]}>ASK THE CUSTOMER FOR THEIR CODE</Text>
                        <Text style={styles.instructSub}>The client's app shows a 4-digit inspection code. Ask them to share it with you.</Text>
                    </View>
                </View>

                <Text style={styles.otpInputLabel}>ENTER INSPECTION CODE</Text>
                <OTPInput
                    disabled={actionLoading}
                    onChange={(code) => setInspectionOtp(code.split('').concat(Array(4).fill('')).slice(0, 4))}
                />

                <PremiumButton
                    title="Verify & Begin Inspection"
                    onPress={handleVerifyInspectionOtp}
                    loading={actionLoading}
                    disabled={inspectionOtp.join('').length < 4}
                    style={{ marginTop: 16 }}
                />
            </View>
        </FadeInView>
    );

    // ── INSPECTION ─────────────────────────────────────────────────────────
    if (isInspection) return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: '#00E0FF33' }]}>
                <View style={styles.phaseHeader}>
                    <View style={[styles.phaseIconBox, { backgroundColor: '#00E0FF15' }]}>
                        <Text style={{ fontSize: 24 }}>📋</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.phaseMeta}>ASSESSMENT PHASE</Text>
                        <Text style={styles.phaseTitle}>Service Estimate</Text>
                    </View>
                    <View style={[styles.timerBadge, { borderColor: '#00E0FF55' }]}>
                        <Text style={[styles.timerTxt, { color: '#00E0FF' }]}>{formatTime(timeElapsed)}</Text>
                        <Text style={[styles.timerLbl, { color: '#00E0FF88' }]}>ELAPSED</Text>
                    </View>
                </View>

                <Text style={[styles.phaseSub, { marginBottom: 16 }]}>
                    Inspect the issue and fill out your professional assessment below.
                </Text>

                <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>ESTIMATED TIME (MINUTES)</Text>
                    <View style={styles.formInputRow}>
                        <TextInput
                            style={[styles.formInput, { flex: 1 }]}
                            keyboardType="numeric"
                            placeholder="e.g. 90"
                            placeholderTextColor={tTheme.text.tertiary}
                            value={estimateData.minutes}
                            onChangeText={(v) => setEstimateData(p => ({ ...p, minutes: v }))}
                        />
                        <View style={styles.unitBox}>
                            <Text style={styles.unitTxt}>MIN</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.formGroup}>
                    <Text style={styles.formLabel}>FINDINGS & NOTES</Text>
                    <TextInput
                        style={styles.formTextArea}
                        multiline
                        placeholder="Describe the issue and proposed fix…"
                        placeholderTextColor={tTheme.text.tertiary}
                        value={estimateData.notes}
                        onChangeText={(v) => setEstimateData(p => ({ ...p, notes: v }))}
                    />
                </View>

                <PremiumButton
                    title="Send Estimate to Client →"
                    onPress={handleSubmitEstimate}
                    loading={actionLoading}
                    disabled={!estimateData.minutes}
                    style={{ marginTop: 8 }}
                />

            </View>
        </FadeInView>
    );

    // ── ESTIMATE SUBMITTED ─────────────────────────────────────────────────
    if (isEstimateSubmitted) return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: tTheme.status?.warning?.base + '44' }]}>
                <View style={styles.phaseHeader}>
                    <Animated.View style={[styles.phaseIconBox, { backgroundColor: tTheme.status?.warning?.base + '15', transform: [{ scale: pulseAnim }] }]}>
                        <Text style={{ fontSize: 24 }}>⏳</Text>
                    </Animated.View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.phaseMeta}>{job?.metadata?.is_followup ? 'FOLLOW-UP SESSION' : 'AWAITING APPROVAL'}</Text>
                        <Text style={styles.phaseTitle}>{job?.metadata?.is_followup ? 'Start Follow-up' : 'Estimate Sent'}</Text>
                    </View>
                </View>

                <View style={[styles.instructBanner, { backgroundColor: tTheme.status?.warning?.base + '08', borderColor: tTheme.status?.warning?.base + '22' }]}>
                    <Text style={{ fontSize: 18 }}>⏳</Text>
                    <View style={{ flex: 1 }}>
                        <Text style={[styles.instructTitle, { color: tTheme.status?.warning?.base }]}>
                            {job?.metadata?.is_followup ? 'READY TO RESUME WORK' : 'WAITING FOR APPROVAL'}
                        </Text>
                        <Text style={styles.instructSub}>
                            {job?.metadata?.is_followup 
                                ? "The customer has been notified. Once they accept, your timer will start automatically."
                                : "The customer is reviewing your estimate. Once they accept, your timer will start automatically."
                            }
                        </Text>
                    </View>
                </View>

                <View style={[styles.statusHero, { marginTop: 24, paddingVertical: 12, backgroundColor: tTheme.status?.warning?.base + '08', borderRadius: 12 }]}>
                    <ActivityIndicator size="small" color={tTheme.status?.warning?.base} style={{ marginBottom: 8 }} />
                    <Text style={[styles.heroSub, { textAlign: 'center', fontSize: 12, color: tTheme.text?.secondary }]}>
                        Waiting for client decision...
                    </Text>
                </View>
            </View>
        </FadeInView>
    );
    // ── ACTIVE SESSION / IN PROGRESS ───────────────────────────────────────
    if (isInProgress) return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: tTheme.status?.success?.base + '33' }]}>
                <View style={styles.phaseHeader}>
                    <View style={[styles.phaseIconBox, { backgroundColor: tTheme.status?.success?.base + '15' }]}>
                        <Text style={{ fontSize: 24 }}>🔧</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.phaseMeta}>ACTIVE SESSION</Text>
                        <Text style={styles.phaseTitle}>Work In Progress</Text>
                    </View>
                </View>

                <View style={{ alignItems: 'flex-end', marginVertical: 20 }}>
                    <View style={[styles.timerBadge, { borderColor: tTheme.status?.success?.base + '55', paddingVertical: 6, marginBottom: 4 }]}>
                        <Text style={[styles.timerTxt, { color: tTheme.status?.success?.base }]}>
                            {formatTime(Math.max(0, ((job?.billing_cap_minutes || job?.estimated_duration_minutes || 0) * 60) - timeElapsed))}
                        </Text>
                        <Text style={[styles.timerLabel, { color: tTheme.status?.success?.base }]}>REMAINING</Text>
                    </View>
                    <Text style={{ fontSize: 10, color: tTheme.status?.success?.base, fontWeight: '700', paddingRight: 4 }}>
                        ELAPSED: {formatTime(timeElapsed)}
                    </Text>
                </View>

                {job?.hourly_rate && (
                    <View style={styles.costRow}>
                        <Text style={styles.costLabel}>Rate</Text>
                        <Text style={styles.costVal}>₹{job.hourly_rate}/hr</Text>
                        <Text style={styles.costSep}>·</Text>
                        <Text style={styles.costLabel}>Est. Total</Text>
                        <Text style={[styles.costVal, { color: tTheme.status?.success?.base }]}>
                            ₹{Math.round(parseFloat(job.hourly_rate) * timeElapsed / 3600)}
                        </Text>
                    </View>
                )}

                <View style={{ gap: 10 }}>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <PremiumButton
                            title="Extension"
                            variant="secondary"
                            onPress={() => navigation.navigate('ExtensionRequest', { jobId })}
                            disabled={actionLoading}
                            style={{ flex: 1 }}
                        />
                        <TouchableOpacity
                            style={[styles.stopBtn]}
                            onPress={() => setStopSheetVisible(true)}
                            activeOpacity={0.8}
                        >
                            <Text style={{ fontSize: 18 }}>⏸</Text>
                            <Text style={styles.stopBtnTxt}>Stop / Pause</Text>
                        </TouchableOpacity>
                    </View>
                    <PremiumButton
                        title="Mark Work Complete ✓"
                        onPress={handleMarkComplete}
                        loading={actionLoading}
                    />
                </View>
            </View>
        </FadeInView>
    );

    // ── REQUESTS (PAUSE, RESUME, SUSPEND) ──────────────────────────────────
    if (status === 'pause_requested') return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: '#F59E0B44', alignItems: 'center' }]}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>⏸</Text>
                <Text style={[styles.phaseTitle, { color: '#F59E0B', textAlign: 'center' }]}>Pause Requested</Text>
                <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16 }]}>
                    Waiting for customer to approve the pause with their OTP. Timer is still running.
                </Text>
                
                {/* Capture and display local actionOtp if available (fixes race condition) */}
                {(actionOtp || job?.action_otp) ? (
                    <View style={{ marginTop: 8, alignItems: 'center', backgroundColor: '#F59E0B11', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#F59E0B33' }}>
                        <Text style={{ color: '#F59E0B', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 }}>SHARE THIS CODE TO APPROVE PAUSE:</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {String(actionOtp || job?.action_otp || '').split('').map((digit, idx) => (
                                <View key={idx} style={{ width: 44, height: 52, borderRadius: 12, backgroundColor: tTheme.background.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F59E0B55' }}>
                                    <Text style={{ color: '#F59E0B', fontSize: 22, fontWeight: '900' }}>{digit}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                    <View style={[styles.liveBadge, { backgroundColor: '#F59E0B11', borderColor: '#F59E0B33', borderWidth: 1 }]}>
                        <ActivityIndicator size="small" color="#F59E0B" />
                        <Text style={[styles.liveTxt, { color: '#F59E0B', marginLeft: 6 }]}>WAITING FOR CLIENT TO APPROVE</Text>
                    </View>
                )}
            </View>
        </FadeInView>
    );

    if (status === 'work_paused') return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: '#F59E0B44', alignItems: 'center' }]}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>🟡</Text>
                <Text style={[styles.phaseTitle, { color: '#F59E0B', textAlign: 'center' }]}>Work Paused</Text>
                <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 4 }]}>
                    Reason: {job?.pause_reason || '—'}
                </Text>
                <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16, fontSize: 11 }]}>
                    Timer is paused. Customer must approve resume OTP to restart.
                </Text>
                <PremiumButton
                    title="▶ Request Resume"
                    onPress={handleRequestResume}
                    loading={actionLoading}
                />
            </View>
        </FadeInView>
    );

    if (status === 'resume_requested') return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: '#22c55e44', alignItems: 'center' }]}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>▶</Text>
                <Text style={[styles.phaseTitle, { color: '#22c55e', textAlign: 'center' }]}>Resume Requested</Text>
                <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16 }]}>
                    Waiting for customer to enter their resume OTP to restart the timer.
                </Text>

                {/* Capture and display local actionOtp if available (fixes race condition) */}
                {(actionOtp || job?.action_otp) ? (
                    <View style={{ marginTop: 8, alignItems: 'center', backgroundColor: '#22c55e11', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#22c55e33' }}>
                        <Text style={{ color: '#22c55e', fontSize: 9, fontWeight: '900', letterSpacing: 1.5, marginBottom: 8 }}>SHARE THIS CODE TO RESTART TIMER:</Text>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {String(actionOtp || job?.action_otp || '').split('').map((digit, idx) => (
                                <View key={idx} style={{ width: 44, height: 52, borderRadius: 12, backgroundColor: tTheme.background.surface, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#22c55e55' }}>
                                    <Text style={{ color: '#22c55e', fontSize: 22, fontWeight: '900' }}>{digit}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : (
                    <View style={[styles.liveBadge, { backgroundColor: '#22c55e11', borderColor: '#22c55e33', borderWidth: 1 }]}>
                        <ActivityIndicator size="small" color="#22c55e" />
                        <Text style={[styles.liveTxt, { color: '#22c55e', marginLeft: 6 }]}>WAITING FOR CLIENT TO APPROVE</Text>
                    </View>
                )}
            </View>
        </FadeInView>
    );

    if (status === 'suspend_requested') return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: '#8B5CF644', alignItems: 'center' }]}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>📅</Text>
                <Text style={[styles.phaseTitle, { color: '#8B5CF6', textAlign: 'center' }]}>Reschedule Requested</Text>
                <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 4 }]}>
                    Proposed: {job?.suspend_reschedule_at ? new Date(job.suspend_reschedule_at).toLocaleString() : '—'}
                </Text>
                <View style={[styles.liveBadge, { backgroundColor: '#8B5CF611', borderColor: '#8B5CF633', borderWidth: 1 }]}>
                    <ActivityIndicator size="small" color="#8B5CF6" />
                    <Text style={[styles.liveTxt, { color: '#8B5CF6', marginLeft: 6 }]}>WAITING FOR CLIENT TO APPROVE</Text>
                </View>
            </View>
        </FadeInView>
    );

    // ── CUSTOMER STOPPING ──────────────────────────────────────────────────
    if (status === 'customer_stopping') return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: '#EF444444', alignItems: 'center' }]}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>⛔</Text>
                <Text style={[styles.phaseTitle, { color: '#EF4444', textAlign: 'center' }]}>Customer Stopping Work</Text>
                <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 4 }]}>
                    The customer has requested to stop. You have a 5-minute safe-stop window — wrap up safely.
                </Text>
                <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16, fontSize: 11, color: '#F59E0B' }]}>
                    Timer is frozen. You will be billed for actual elapsed time.
                </Text>
                <PremiumButton
                    title="Acknowledge & Generate Bill"
                    onPress={handleAcknowledgeStop}
                    loading={actionLoading}
                    style={{ marginTop: 8, width: '100%' }}
                />
            </View>
        </FadeInView>
    );

    // ── SUSPENDED / RESCHEDULED ────────────────────────────────────────────
    if (status === 'suspended') return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: tTheme.status.success.base + '44', alignItems: 'center' }]}>
                <Text style={{ fontSize: 56, marginBottom: 8 }}>📅</Text>
                <Text style={[styles.phaseTitle, { color: tTheme.status.success.base, textAlign: 'center' }]}>
                    Session Rescheduled
                </Text>
                <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16 }]}>
                    Today's work has been saved and billed. Your follow-up session is ready.
                </Text>
                {job?.followup_job_id ? (
                    <PremiumButton
                        title="Go to Follow-up Job →"
                        onPress={() => {
                            useWorkerStore.getState().setActiveJob(null);
                            navigation.replace('ActiveJob', { jobId: job.followup_job_id });
                        }}
                        style={{ marginTop: 8, width: '100%' }}
                    />
                ) : (
                    <PremiumButton
                        variant="secondary"
                        title="Back to Dashboard"
                        onPress={() => {
                            useWorkerStore.getState().setActiveJob(null);
                            navigation.navigate('WorkerTabs');
                        }}
                        style={{ marginTop: 8, width: '100%' }}
                    />
                )}
            </View>
        </FadeInView>
    );

    // ── FINAL STATES ───────────────────────────────────────────────────────
    if (isPending) return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: tTheme.status?.success?.base + '33', alignItems: 'center' }]}>
                <View style={styles.phaseHeader}>
                    <View style={[styles.phaseIconBox, { backgroundColor: tTheme.status?.success?.base + '15' }]}>
                        <Text style={{ fontSize: 24 }}>✅</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.phaseMeta}>AWAITING CONFIRMATION</Text>
                        <Text style={styles.phaseTitle}>Share Completion Code</Text>
                    </View>
                </View>

                <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 4 }]}>
                    Show this code to your client. They will enter it to confirm work completion and trigger the payment.
                </Text>

                <EndOtpDigits code={endOtp} theme={tTheme} />

                <View style={[styles.liveBadge, { marginTop: 8, backgroundColor: '#00E0FF11', borderColor: '#00E0FF33', borderWidth: 1 }]}>
                    <ActivityIndicator size="small" color="#00E0FF" />
                    <Text style={[styles.liveTxt, { color: '#00E0FF', marginLeft: 6 }]}>Awaiting client confirmation</Text>
                </View>

                <PremiumButton
                    variant="secondary"
                    title="Edit Materials / Spares"
                    onPress={() => setMaterialModalVisible && setMaterialModalVisible(true)}
                    style={{ marginTop: 16, width: '100%' }}
                />
            </View>
        </FadeInView>
    );

    if (isCompleted) return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: tTheme.status?.success?.base + '44', alignItems: 'center' }]}>
                <Text style={{ fontSize: 56, marginBottom: 8 }}>🎉</Text>
                <Text style={[styles.phaseTitle, { color: tTheme.status?.success?.base, textAlign: 'center' }]}>
                    {status === 'completed' ? 'Session Complete!' : 'Session Ended'}
                </Text>
                <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16 }]}>
                    {status === 'completed'
                        ? 'Great work! The payment has been initiated. Check your wallet for the credit.'
                        : 'This session has been closed.'}
                </Text>
                {job?.final_amount && (
                    <View style={[styles.earningsBox, { borderColor: tTheme.status?.success?.base + '44' }]}>
                        <Text style={styles.earningsLabel}>EARNED</Text>
                        <Text style={[styles.earningsAmount, { color: tTheme.status?.success?.base }]}>
                            ₹{parseFloat(job.final_amount).toFixed(0)}
                        </Text>
                    </View>
                )}
                <PremiumButton
                    variant="secondary"
                    title="Back to Dashboard"
                    onPress={() => navigation.navigate('WorkerTabs')}
                    style={{ marginTop: 8 }}
                />
            </View>
        </FadeInView>
    );

    if (status === 'cancelled') return (
        <FadeInView delay={100}>
            <View style={[styles.phaseCard, { borderColor: tTheme.status?.error?.base + '44', alignItems: 'center' }]}>
                <Text style={{ fontSize: 56, marginBottom: 8 }}>🚫</Text>
                <Text style={[styles.phaseTitle, { color: tTheme.status?.error?.base, textAlign: 'center' }]}>Job Cancelled</Text>
                <Text style={[styles.phaseSub, { textAlign: 'center', marginBottom: 16 }]}>
                    The customer has cancelled this request. You can now return to the marketplace to find new opportunities.
                </Text>
                <PremiumButton
                    variant="secondary"
                    title="Return to Dashboard"
                    onPress={() => {
                        useWorkerStore.getState().setActiveJob(null);
                        navigation.replace('WorkerTabs');
                    }}
                    style={{ marginTop: 8 }}
                />
            </View>
        </FadeInView>
    );

    return null;
}
