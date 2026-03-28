import {
    View, Text, StyleSheet, ScrollView, TouchableOpacity,
    Alert, ActivityIndicator, Linking, TextInput, Animated,
    Modal, Platform, DatePickerAndroid
} from 'react-native';

export const createActiveJobScreenStyles = (t) => StyleSheet.create({
    screen: { flex: 1 },
    loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingTxt: { color: t.text.tertiary, fontSize: 11, fontWeight: '700', letterSpacing: 1.5 },

    // Header
    header: {
        paddingTop: 60, paddingHorizontal: 20, paddingBottom: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    },
    headerBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center' },
    headerBtnTxt: { color: t.text.primary, fontSize: 20 },
    headerCenter: { alignItems: 'center', gap: 4 },
    headerTitle: { color: t.brand.primary, fontSize: 9, fontWeight: '900', letterSpacing: 3 },
    statusPillWrap: { transform: [{ scale: 0.85 }] },
    chatBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: t.background.surface, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    badge: { position: 'absolute', top: -4, right: -4, backgroundColor: t.status.error.base, minWidth: 18, height: 18, borderRadius: 9, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 3, borderWidth: 2, borderColor: t.background.app },
    badgeTxt: { color: '#FFF', fontSize: 9, fontWeight: '900' },

    scroll: { paddingBottom: 120 },

    // Client card
    clientCard: {
        marginHorizontal: 16, marginBottom: 12,
        backgroundColor: t.background.surface, borderRadius: 20, padding: 16,
        borderWidth: 1, borderColor: t.border.default + '22',
        gap: 12,
        ...t.shadows?.premium,
    },
    clientRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    clientAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: t.brand.primary + '15', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: t.brand.primary + '22' },
    avatarTxt: { color: t.brand.primary, fontSize: 22, fontWeight: '900' },
    clientLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
    clientName: { color: t.text.primary, fontSize: 16, fontWeight: '900' },
    clientCat: { color: t.text.secondary, fontSize: 11, marginTop: 1, textTransform: 'capitalize' },
    callChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: t.background.surfaceRaised, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, borderWidth: 1, borderColor: t.border.default + '22' },
    callChipTxt: { color: t.text.secondary, fontSize: 11, fontWeight: '700' },
    addrRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: t.background.app, borderRadius: 12, padding: 12, borderWidth: 1, borderColor: t.border.default + '15' },
    addrTxt: { color: t.text.secondary, fontSize: 13, flex: 1, lineHeight: 18 },
    navChip: { color: t.brand.primary, fontSize: 11, fontWeight: '700', marginLeft: 8, backgroundColor: t.brand.primary + '11', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },

    // Phase cards
    phaseCard: {
        marginHorizontal: 16, marginBottom: 12,
        backgroundColor: t.background.surface, borderRadius: 20, padding: 20,
        borderWidth: 1, borderColor: t.border.default + '22',
        ...t.shadows?.premium,
    },
    phaseHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
    phaseIconBox: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center' },
    phaseMeta: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 2 },
    phaseTitle: { color: t.text.primary, fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
    phaseSub: { color: t.text.secondary, fontSize: 13, lineHeight: 18 },

    // instruc banner
    instructBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, borderRadius: 12, borderWidth: 1, padding: 12, marginBottom: 14 },
    instructIcon: { fontSize: 18, marginTop: 1 },
    instructTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, marginBottom: 2 },
    instructSub: { color: t.text.tertiary, fontSize: 11, lineHeight: 16 },

    // OTP input area
    otpInputLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 8, textAlign: 'center' },

    // countdown
    countdownBox: { alignItems: 'center', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, borderWidth: 1.5 },
    countdownVal: { fontSize: 18, fontWeight: '900' },
    countdownLbl: { fontSize: 8, fontWeight: '900', letterSpacing: 1.5, color: t.text.muted },

    // timer badge (small)
    timerBadge: { alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1.5 },
    timerTxt: { fontSize: 16, fontWeight: '900', letterSpacing: 1 },
    timerLbl: { fontSize: 8, fontWeight: '800', letterSpacing: 1.5, marginTop: 1 },

    // big timer (in_progress)
    bigTimerWrap: { alignItems: 'center', marginVertical: 20, gap: 10 },
    bigTimerVal: { fontSize: 62, fontWeight: '900', letterSpacing: 2, fontVariant: ['tabular-nums'] },

    // cost row
    costRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
    costLabel: { color: t.text.tertiary, fontSize: 12, fontWeight: '700' },
    costVal: { color: t.text.primary, fontSize: 14, fontWeight: '900' },
    costSep: { color: t.text.tertiary, fontSize: 16 },

    // estimate form
    formGroup: { marginBottom: 14 },
    formLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 6 },
    formInputRow: { flexDirection: 'row', gap: 8 },
    formInput: { backgroundColor: t.background.app, color: t.text.primary, borderRadius: 12, borderWidth: 1, borderColor: t.border.default + '44', paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, fontWeight: '700' },
    unitBox: { backgroundColor: t.brand.primary + '15', paddingHorizontal: 14, borderRadius: 12, justifyContent: 'center', borderWidth: 1, borderColor: t.brand.primary + '22' },
    unitTxt: { color: t.brand.primary, fontWeight: '900', fontSize: 12, letterSpacing: 1 },
    formTextArea: { backgroundColor: t.background.app, color: t.text.primary, borderRadius: 12, borderWidth: 1, borderColor: t.border.default + '44', paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, minHeight: 100, textAlignVertical: 'top', lineHeight: 20 },

    // divider
    dividerLine: { height: 1, backgroundColor: t.border.default + '22' },

    // live badge
    liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
    liveDot: { width: 6, height: 6, borderRadius: 3 },
    liveTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 1 },

    // action row (assigned phase)
    actionRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
    iconActionBtn: { flex: 1, alignItems: 'center', gap: 6, backgroundColor: t.background.surfaceRaised, borderRadius: 14, paddingVertical: 14, borderWidth: 1, borderColor: t.border.default + '22' },
    iconActionTxt: { color: t.text.secondary, fontSize: 11, fontWeight: '700' },

    // address box
    addressBox: { backgroundColor: t.background.app, borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: t.border.default + '15' },
    addressLabel: { color: t.text.tertiary, fontSize: 9, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
    addressText: { color: t.text.primary, fontSize: 14, fontWeight: '600', lineHeight: 20 },

    // earnings
    earningsBox: { alignItems: 'center', backgroundColor: t.background.surfaceRaised, borderRadius: 16, paddingHorizontal: 32, paddingVertical: 20, borderWidth: 1.5, marginVertical: 8 },
    earningsLabel: { color: t.text.tertiary, fontSize: 10, fontWeight: '900', letterSpacing: 2, marginBottom: 4 },
    earningsAmount: { fontSize: 48, fontWeight: '900', letterSpacing: 1 },

    // Stop / Pause button (in_progress row)
    stopBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF444415', borderRadius: 14, paddingVertical: 14, borderWidth: 1.5, borderColor: '#EF444444' },
    stopBtnTxt: { color: '#EF4444', fontWeight: '800', fontSize: 13 },

    // Modal sheet
    sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'flex-end' },
    sheetContainer: { backgroundColor: t.background.surfaceRaised, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, paddingBottom: 44 },
    sheetTitle: { color: t.text.primary, fontSize: 20, fontWeight: '900', marginBottom: 4 },
    sheetSub: { color: t.text.tertiary, fontSize: 12, marginBottom: 16, lineHeight: 18 },
    sheetChoiceCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: t.background.app, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: t.border.default + '33' },
    sheetChoiceTitle: { color: t.text.primary, fontSize: 15, fontWeight: '800', marginBottom: 3 },
    sheetChoiceSub: { color: t.text.tertiary, fontSize: 12, lineHeight: 17 },
    sheetCancel: { alignItems: 'center', paddingVertical: 12 },
    sheetCancelTxt: { color: t.text.tertiary, fontSize: 13, fontWeight: '700' },

    // Date picker button
    datePickerBtn: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.background.app, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: t.border.default + '44' },
    datePickerTxt: { flex: 1, color: t.text.primary, fontSize: 14, fontWeight: '700' },
});
