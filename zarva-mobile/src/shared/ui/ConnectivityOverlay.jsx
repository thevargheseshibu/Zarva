/**
 * src/components/ConnectivityOverlay.jsx
 * 
 * High-level component to block the app if internet is down or server is offline.
 */
import React from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { useUIStore } from '@shared/hooks/uiStore';
import { useTokens } from '../design-system';

const { width, height } = Dimensions.get('window');

const ConnectivityOverlay = ({ children }) => {
    const { isNetConnected, isServerUp, setNetConnected, setServerUp } = useUIStore();
    const t = useTokens();
    const dynStyles = React.useMemo(() => createOverlayStyles(t), [t]);

    const fadeAnim = React.useRef(new Animated.Value(0)).current;

    const [isChecking, setIsChecking] = React.useState(false);

    const isBlocking = !isNetConnected || !isServerUp;

    React.useEffect(() => {
        Animated.timing(fadeAnim, {
            toValue: isBlocking ? 1 : 0,
            duration: 400,
            useNativeDriver: true,
        }).start();
    }, [isBlocking]);

    const handleRetry = async () => {
        setIsChecking(true);
        try {
            // Check server by calling health endpoint
            const { default: apiClient } = await import('@infra/api/client');
            const serverRes = await apiClient.get('/api/health').catch(() => null);
            const up = serverRes?.status === 200;
            setServerUp(up);
            setNetConnected(up);
        } catch (e) {
            console.log('[ConnectivityOverlay] Retry failed', e);
        } finally {
            setIsChecking(false);
        }
    };

    if (!isBlocking && fadeAnim._value === 0) {
        return children;
    }

    const type = !isNetConnected ? 'internet' : 'server';

    return (
        <View style={styles.root}>
            {children}

            <Animated.View style={[styles.overlay, { opacity: fadeAnim }]} pointerEvents={isBlocking ? 'auto' : 'none'}>
                <BlurView intensity={Platform.OS === 'ios' ? 70 : 100} tint="dark" style={StyleSheet.absoluteFill} />

                <View style={dynStyles.content}>
                    <View style={[dynStyles.iconContainer, { backgroundColor: type === 'internet' ? '#EF444422' : '#F59E0B22' }]}>
                        <Text style={dynStyles.icon}>{type === 'internet' ? '🌐' : '⚒️'}</Text>
                    </View>

                    <Text style={dynStyles.title}>
                        {type === 'internet' ? 'Internet Required' : 'Server Under Repair'}
                    </Text>

                    <Text style={dynStyles.subtitle}>
                        {type === 'internet'
                            ? "Zarva requires an active internet connection to function. Please check your data or Wi-Fi."
                            : "Our systems are undergoing maintenance to serve you better. We'll be back in a few minutes."}
                    </Text>


                    <TouchableOpacity
                        style={[dynStyles.retryBtn, { backgroundColor: t.brand.primary }]}
                        onPress={handleRetry}
                        disabled={isChecking}
                        activeOpacity={0.8}
                    >
                        {isChecking ? (
                            <ActivityIndicator color={t.background.app} />
                        ) : (
                            <Text style={dynStyles.retryText}>Try Again</Text>
                        )}
                    </TouchableOpacity>

                    {type === 'server' && (
                        <Text style={dynStyles.statusFooter}>ZARVA Systems · Under Maintenance</Text>
                    )}
                </View>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    root: { flex: 1 },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999,
    },
});

const createOverlayStyles = (t) => StyleSheet.create({
    content: {
        width: width * 0.85,
        padding: 30,
        borderRadius: 30,
        backgroundColor: t.background.surface + 'CC',
        borderWidth: 1,
        borderColor: t.border.default + '22',
        alignItems: 'center',
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    icon: { fontSize: 40 },
    title: {
        color: t.text.primary,
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        color: t.text.secondary,
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 30,
    },
    retryBtn: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    retryText: {
        color: t.background.app,
        fontSize: 16,
        fontWeight: '800',
    },
    statusFooter: {
        marginTop: 20,
        color: t.text.tertiary,
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
});

export default ConnectivityOverlay;
