import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { useTokens } from '../design-system';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import GoldButton from './GoldButton';

const JobAlertSheet = forwardRef(({ onAccept }, ref) => {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const bottomSheetRef = React.useRef(null);
    const [job, setJob] = useState(null);
    const [timeLeft, setTimeLeft] = useState(30);

    useImperativeHandle(ref, () => ({
        showAlert: (jobData) => {
            setJob(jobData);
            setTimeLeft(30);
            bottomSheetRef.current?.expand();
        },
        hideAlert: () => {
            bottomSheetRef.current?.close();
            setJob(null);
        }
    }));

    useEffect(() => {
        let timer;
        if (job && timeLeft > 0) {
            timer = setInterval(() => {
                setTimeLeft(prev => prev - 1);
            }, 1000);
        } else if (job && timeLeft === 0) {
            bottomSheetRef.current?.close();
            setJob(null);
        }
        return () => clearInterval(timer);
    }, [job, timeLeft]);

    if (!job) return null;

    return (
        <BottomSheet
            ref={bottomSheetRef}
            snapPoints={['68%']}
            enablePanDownToClose
            backgroundStyle={styles.sheetBackground}
            handleIndicatorStyle={styles.handle}
            onClose={() => setJob(null)}
        >
            <BottomSheetView style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>🔔 New Job Request</Text>
                    <Text style={[styles.timer, timeLeft <= 10 && styles.timerDanger]}>
                        00:{timeLeft.toString().padStart(2, '0')}
                    </Text>
                </View>

                <View style={styles.infoRow}>
                    <Text style={styles.category}>{job.category}</Text>
                    <Text style={styles.est}>{job.est}</Text>
                </View>

                <Text style={styles.distTxt}>📍 {job.dist} km away • {job.area}</Text>

                <View style={styles.descBox}>
                    {job.photo && <Image source={{ uri: job.photo }} style={styles.thumb} />}
                    <Text style={styles.desc} numberOfLines={3}>"{job.desc}"</Text>
                </View>

                <View style={styles.actionRow}>
                    <TouchableOpacity
                        style={styles.ghostBtn}
                        onPress={() => bottomSheetRef.current?.close()}
                    >
                        <Text style={styles.ghostTxt}>❌ Decline</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1.5 }}>
                        <GoldButton
                            title="✅ Accept Now"
                            onPress={() => {
                                bottomSheetRef.current?.close();
                                if (onAccept) onAccept(job);
                            }}
                        />
                    </View>
                </View>
            </BottomSheetView>
        </BottomSheet>
    );
});

const createStyles = (t) => StyleSheet.create({
    sheetBackground: { backgroundColor: t.background.surfaceRaised },
    handle: { backgroundColor: t.text.tertiary },
    container: { flex: 1, padding: t.spacing.lg, gap: t.spacing.lg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: t.text.primary, fontSize: 20, fontWeight: '800' },
    timer: { color: t.text.primary, fontSize: 18, fontWeight: '700' },
    timerDanger: { color: t.status.error.base },
    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderBottomColor: t.background.surface, borderBottomWidth: 1, paddingBottom: t.spacing.sm },
    category: { color: t.text.secondary, fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
    est: { color: t.brand.primary, fontSize: 28, fontWeight: '800' },
    distTxt: { color: t.text.primary, fontSize: 16 },
    descBox: { flexDirection: 'row', gap: t.spacing.md, backgroundColor: t.background.surface, padding: t.spacing.md, borderRadius: t.radius.md },
    thumb: { width: 60, height: 60, borderRadius: t.radius.sm, backgroundColor: t.background.surfaceRaised },
    desc: { flex: 1, color: t.text.tertiary, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },
    actionRow: { flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, marginTop: 'auto', marginBottom: t.spacing.xl },
    ghostBtn: { flex: 1, padding: t.spacing.md, alignItems: 'center' },
    ghostTxt: { color: t.text.tertiary, fontSize: 16, fontWeight: '700' }
});

export default JobAlertSheet;
