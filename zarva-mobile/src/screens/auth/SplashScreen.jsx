import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { colors } from '../../design-system/tokens';
import RadarAnimation from '../../components/RadarAnimation';

export default function SplashScreen({ navigation }) {
    React.useEffect(() => {
        const t = setTimeout(() => navigation.replace('Language'), 2000);
        return () => clearTimeout(t);
    }, []);

    return (
        <View style={styles.screen}>
            <RadarAnimation size={80} />
            <Text style={styles.brand}>ZARVA</Text>
            <Text style={styles.tagline}>Kerala's Premier Home Services</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary, justifyContent: 'center', alignItems: 'center', gap: 20 },
    brand: { color: colors.gold.primary, fontSize: 42, fontWeight: '800', letterSpacing: 6 },
    tagline: { color: colors.text.secondary, fontSize: 13, letterSpacing: 1 },
});
