import React from 'react';
import { useTokens } from '../design-system';
import { StyleSheet, View, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function MainBackground({ children, style }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <LinearGradient
                colors={[tTheme.background.surface, tTheme.background.app, tTheme.background.app]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, style]}
            />
            {/* Ambient Bloom Light (Top Left) - Purple */}
            <LinearGradient
                colors={['rgba(124, 58, 237, 0.15)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0.8, y: 0.8 }}
                style={StyleSheet.absoluteFill}
            />
            {/* Ambient Bloom Light (Bottom Right) - Pink */}
            <LinearGradient
                colors={['transparent', 'rgba(236, 72, 153, 0.15)']}
                start={{ x: 0.2, y: 0.2 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
            />
            {children}
        </View>
    );
}

const createStyles = (t) => StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: t.background.app,
    },
});
