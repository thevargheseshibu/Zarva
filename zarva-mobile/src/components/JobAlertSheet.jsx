import React, { useEffect, useState, forwardRef, useImperativeHandle } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from './GoldButton';

/*
  Usage:
  const alertSheetRef = useRef(null);
  <JobAlertSheet ref={alertSheetRef} onAccept={handleAccept} />
  
  Trigger via: alertSheetRef.current?.showAlert(jobData);
*/

const JobAlertSheet = forwardRef(({ onAccept }, ref) => {
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
            snapPoints={['65%']}
            enablePanDownToClose
            backgroundStyle={{ backgroundColor: colors.bg.elevated }}
            handleIndicatorStyle={{ backgroundColor: colors.text.muted }}
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

const styles = StyleSheet.create({
    container: { flex: 1, padding: spacing.lg, gap: spacing.lg },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    title: { color: colors.text.primary, fontSize: 20, fontWeight: '800' },
    timer: { color: colors.text.primary, fontSize: 18, fontWeight: '700', fontFamily: 'Courier' },
    timerDanger: { color: colors.danger },

    infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', borderBottomColor: colors.bg.surface, borderBottomWidth: 1, paddingBottom: spacing.sm },
    category: { color: colors.text.secondary, fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 },
    est: { color: colors.gold.primary, fontSize: 28, fontWeight: '800' },

    distTxt: { color: colors.text.primary, fontSize: 16 },

    descBox: { flexDirection: 'row', gap: spacing.md, backgroundColor: colors.bg.surface, padding: spacing.md, borderRadius: radius.md },
    thumb: { width: 60, height: 60, borderRadius: radius.sm, backgroundColor: colors.bg.elevated },
    desc: { flex: 1, color: colors.text.muted, fontSize: 14, fontStyle: 'italic', lineHeight: 20 },

    actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: 'auto', marginBottom: spacing.xl },
    ghostBtn: { flex: 1, padding: spacing.md, alignItems: 'center' },
    ghostTxt: { color: colors.text.muted, fontSize: 16, fontWeight: '700' }
});

export default JobAlertSheet;
