import React from 'react';
import { useTokens } from '@shared/design-system';
import { View, StyleSheet } from 'react-native';

export default function Card({ children, style }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    return (
        <View style={[styles.card, tTheme.shadows.premium, style]}>
            {children}
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    card: {
        backgroundColor: t.background.surface,
        borderRadius: t.radius.lg,
        padding: t.spacing.md,
    },
});
