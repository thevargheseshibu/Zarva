import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import PressableAnimated from '@shared/design-system/components/PressableAnimated';
import { useTokens } from '@shared/design-system';


export default function PremiumHeader({ title, onBack }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    return (
        <View style={styles.header}>
            <PressableAnimated onPress={onBack} style={styles.headerBtn}>
                <Text style={styles.headerBtnTxt}>←</Text>
            </PressableAnimated>
            <Text style={styles.headerTitle}>{title}</Text>
            <View style={{ width: 44 }} />
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    header: {
        paddingTop: 60,
        paddingHorizontal: t.spacing['2xl'] || 24,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: t.spacing.lg || 16,
    },
    headerBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: t.background.surfaceRaised,
        justifyContent: 'center',
        alignItems: 'center'
    },
    headerBtnTxt: {
        color: t.text.primary,
        fontSize: 20
    },
    headerTitle: {
        color: t.text.primary,
        fontSize: t.typography.size.body,
        fontWeight: t.typography.weight.bold,
        letterSpacing: t.typography.tracking.body
    }
});
