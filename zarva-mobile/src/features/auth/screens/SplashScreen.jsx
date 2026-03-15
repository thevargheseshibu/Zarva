import React from 'react';
import { useTokens } from '@shared/design-system';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';

import RadarAnimation from '@shared/ui/RadarAnimation';
import { useT } from '@shared/i18n/useTranslation';

export default function SplashScreen({ navigation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    const t = useT();
    React.useEffect(() => {
        const t = setTimeout(() => navigation.replace('Language'), 2000);
        return () => clearTimeout(t);
    }, []);

    return (
        <View style={styles.screen}>
            <RadarAnimation size={80} />
            <Text style={styles.brand}>ZARVA</Text>
            <Text style={styles.tagline}>{t('splash_tagline')}</Text>
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    screen: { flex: 1, backgroundColor: t.background.app, justifyContent: 'center', alignItems: 'center', gap: 20 },
    brand: { color: t.brand.primary, fontSize: 42, fontWeight: '800', letterSpacing: 6 },
    tagline: { color: t.text.secondary, fontSize: 13, letterSpacing: 1 },
});
