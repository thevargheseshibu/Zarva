import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing } from '../../design-system/tokens';
import RadarAnimation from '../../components/RadarAnimation';
// import { ref, onValue, off } from 'firebase/database';
// import { db } from '../../utils/firebase';

export default function SearchingScreen({ route, navigation }) {
    const { category, jobId } = route.params || { category: 'electrician', jobId: 'mock-123' };
    const [nearbyCount, setNearbyCount] = useState(5);

    useEffect(() => {
        // Mock Firebase active_jobs listener
        /*
        const jobRef = ref(db, `active_jobs/${jobId}`);
        const listener = onValue(jobRef, (snapshot) => {
            const data = snapshot.val();
            if (data?.status === 'assigned') {
                navigation.replace('JobStatusDetail', { jobId });
            }
        });
        return () => off(jobRef, 'value', listener);
        */

        // Dev mock: auto-assign after 4 seconds
        const timer = setTimeout(() => {
            navigation.replace('JobStatusDetail', { jobId });
        }, 4000);

        return () => clearTimeout(timer);
    }, [jobId, navigation]);

    return (
        <View style={styles.screen}>
            <View style={styles.content}>
                <RadarAnimation size={120} />
                <Text style={styles.title}>Finding a nearby {category}...</Text>
                <Text style={styles.sub}>Checking {nearbyCount} workers nearby</Text>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center' },
    content: { alignItems: 'center', gap: spacing.lg, padding: spacing.xl },
    title: { color: colors.text.primary, fontSize: 24, fontWeight: '700', textAlign: 'center', fontFamily: 'Sohne' },
    sub: { color: colors.gold.primary, fontSize: 16, fontWeight: '600' }
});
