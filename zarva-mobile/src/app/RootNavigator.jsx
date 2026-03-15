import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import AuthNavigator from '@navigation/AuthNavigator';
import { createStackNavigator } from '@react-navigation/stack';
import CustomerStack from '@navigation/CustomerStack';
import WorkerStack from '@navigation/WorkerStack';
import OnboardingNavigator from '@navigation/OnboardingNavigator';
import RoleSelection from '@auth/screens/RoleSelectionScreen';
import CompleteProfileScreen from '@auth/screens/CompleteProfileScreen';
import VerificationPendingScreen from '@worker/onboarding/VerificationPendingScreen';
import BlockedScreen from '@auth/screens/BlockedScreen';
import CreateTicketScreen from '@customer/screens/CreateTicketScreen';
import TicketChatScreen from '@customer/screens/TicketChatScreen';
import { useAuthStore } from '@auth/store';
import { useJobStore } from '@jobs/store';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';

export const navigationRef = createNavigationContainerRef();
const Stack = createStackNavigator();

// Dark navigation theme
const ZarvaTheme = {
    dark: true,
    colors: {
        primary: '#C9A84C',
        background: '#0A0A0F',
        card: '#12121A',
        text: '#F0EDE8',
        border: '#1A1A26',
        notification: '#FF4D6A',
    },
    fonts: {
        regular: { fontFamily: '', fontWeight: '400' },
        medium: { fontFamily: '', fontWeight: '500' },
        bold: { fontFamily: '', fontWeight: '700' },
        heavy: { fontFamily: '', fontWeight: '900' },
    }
};

export default function RootNavigator() {
    const { user, isAuthenticated } = useAuthStore();
    const [isHydrated, setIsHydrated] = useState(false);

    useEffect(() => {
        // Wait for AsyncStorage to be extracted into Zustand
        const checkHydration = () => {
            if (useAuthStore.persist.hasHydrated()) {
                setIsHydrated(true);
            }
        };
        checkHydration();

        const unsub = useAuthStore.persist.onFinishHydration(() => setIsHydrated(true));
        return () => {
            if (unsub) unsub();
        };
    }, []);

    // ── Global Notification Tap Handler (Issue #37) ──────────────────────────
    useEffect(() => {
        if (!isHydrated) return;

        const sub = Notifications.addNotificationResponseReceivedListener(response => {
            const authState = useAuthStore.getState();
            const jobState = useJobStore.getState();

            if (!navigationRef.isReady()) return;

            const role = authState.user?.active_role;
            const pushData = response?.notification?.request?.content?.data;
            const jobId = pushData?.job_id || jobState.activeJob?.id;

            if (jobId) {
                if (pushData?.type === 'NEW_CHAT_MESSAGE') {
                    navigationRef.navigate('Chat', { jobId, userRole: role });
                } else if (pushData?.type === 'NEW_JOB_ALERT' && role === 'worker') {
                    // Route to Preview for unassigned alerts
                    navigationRef.navigate('JobDetailPreview', {
                        job: {
                            id: jobId,
                            category: pushData.category,
                            dist: parseFloat(pushData.distance_km),
                            total_amount: pushData.estimated_earnings
                        }
                    });
                } else if (role === 'customer') {
                    navigationRef.navigate('JobStatusDetail', { jobId });
                } else if (role === 'worker') {
                    navigationRef.navigate('ActiveJob', { jobId });
                }
            }
        });

        return () => {
            if (sub) sub.remove();
        };
    }, [isHydrated]);

    const renderNavigator = () => {
        if (!isHydrated) return <View style={{ flex: 1, backgroundColor: ZarvaTheme.colors.background }} />;

        if (!isAuthenticated || !user) return <AuthNavigator />;

        if (!user.name) {
            return (
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} />
                </Stack.Navigator>
            );
        }

        if (!user.active_role) {
            return (
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="RoleSelection" component={RoleSelection} />
                </Stack.Navigator>
            );
        }

        const role = user.active_role;
        const profile = user.profile || {};
        const onboardingDone = user.onboarding_complete;

        // Debug logging to help diagnose the issue
        console.log('[RootNavigator] User status:', {
            role,
            onboardingDone,
            kyc_status: profile.kyc_status,
            is_blocked: user.is_blocked,
            profileExists: !!profile,
            userId: user.id
        });

        if (user.is_blocked) {
            return (
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="Blocked" component={BlockedScreen} />
                    <Stack.Screen name="CreateTicket" component={CreateTicketScreen} />
                    <Stack.Screen name="TicketChat" component={TicketChatScreen} />
                </Stack.Navigator>
            );
        }

        if (role === 'worker' && !onboardingDone) return <OnboardingNavigator />;

        // FIXED: Only show verification pending for workers who are NOT approved
        // This prevents approved workers from being stuck in verification pending
        if (role === 'worker' && profile.kyc_status && profile.kyc_status !== 'approved') {
            console.log('[RootNavigator] Showing verification pending - KYC status:', profile.kyc_status);
            return (
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="VerificationPending" component={VerificationPendingScreen} />
                </Stack.Navigator>
            );
        }

        if (role === 'customer') return <CustomerStack />;
        if (role === 'worker') return <WorkerStack />;

        // Fallback to auth
        return <AuthNavigator />;
    };

    return (
        <NavigationContainer ref={navigationRef} theme={ZarvaTheme}>
            {renderNavigator()}
        </NavigationContainer>
    );
}