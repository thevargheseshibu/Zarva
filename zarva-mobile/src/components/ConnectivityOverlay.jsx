/**
 * src/components/ConnectivityOverlay.jsx
 * 
 * High-level component to block the app if internet is down or server is offline.
 */
import React from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Platform, TouchableOpacity, ActivityIndicator } from 'react-native';
import { BlurView } from 'expo-blur';
import { useUIStore } from '../stores/uiStore';
import { useTokens } from '../design-system';

const { width, height } = Dimensions.get('window');

const ConnectivityOverlay = ({ children }) => {
    const { isNetConnected, isServerUp, setNetConnected, setServerUp } = useUIStore();
    const t = useTokens();

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
            // Check internet by fetching a stable public URL
            const netRes = await fetch('https://www.google.com', { mode: 'no-cors' }).catch(() => null);
            setNetConnected(!!netRes);

            // Check server by calling health endpoint
            // We'll rely on the apiClient to update the store too, but manual check here helps
            // Note: BASE_URL logic might be needed here, or just use the one from client
            const { default: apiClient } = await import('../services/api/client');
            const serverRes = await apiClient.get('/api/health').catch(() => null);
            setServerUp(serverRes?.status === 200);
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

                <View style={styles.content}>
                    <View style={[styles.iconContainer, { backgroundColor: type === 'internet' ? '#EF444422' : '#F59E0B22' }]}>
                        <Text style={styles.icon}>{type === 'internet' ? '🌐' : '⚒️'}</Text>
                    </View>

                    <Text style={styles.title}>
                        {type === 'internet' ? 'Internet Required' : 'Server Under Repair'}
                    </Text>

                    <Text style={styles.subtitle}>
                        {type === 'internet'
                            ? "Zarva requires an active internet connection to function. Please check your data or Wi-Fi."
                            : "Our systems are undergoing maintenance to serve you better. We'll be back in a few minutes."}
                    </Text>


                    <TouchableOpacity
                        style={[styles.retryBtn, { backgroundColor: t.brand.primary }]}
                        onPress={handleRetry}
                        disabled={isChecking}
                        activeOpacity={0.8}
                    >
                        {isChecking ? (
                            <ActivityIndicator color="#000" />
                        ) : (
                            <Text style={styles.retryText}>Try Again</Text>
                        )}
                    </TouchableOpacity>

                    {type === 'server' && (
                        <Text style={styles.statusFooter}>ZARVA Systems · Under Maintenance</Text>
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
    content: {
        width: width * 0.85,
        padding: 30,
        borderRadius: 30,
        backgroundColor: '#15151A99',
        borderWidth: 1,
        borderColor: '#FFFFFF15',
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
        color: '#FFFFFF',
        fontSize: 24,
        fontWeight: '900',
        marginBottom: 12,
        textAlign: 'center',
    },
    subtitle: {
        color: '#A0A0AB',
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
        color: '#000000',
        fontSize: 16,
        fontWeight: '800',
    },
    statusFooter: {
        marginTop: 20,
        color: '#52525B',
        fontSize: 10,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    }
});

export default ConnectivityOverlay;
