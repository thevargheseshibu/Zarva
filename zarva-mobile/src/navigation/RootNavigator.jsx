/**
 * src/navigation/RootNavigator.jsx
 *
 * Auth-gated root: reads authStore.user.active_role and renders the correct navigator.
 *   no user     → AuthNavigator
 *   customer    → CustomerNavigator
 *   worker      → WorkerNavigator  (or OnboardingNavigator if incomplete)
 */
import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import AuthNavigator from './AuthNavigator';
import { createStackNavigator } from '@react-navigation/stack';
import CustomerStack from './CustomerStack';
import WorkerStack from './WorkerStack';
import OnboardingNavigator from './OnboardingNavigator';
import RoleSelection from '../screens/auth/RoleSelection';
import { useAuthStore } from '../stores/authStore';
import { useJobStore } from '../stores/jobStore';
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
            const jobId = jobState.activeJob?.id;

            if (jobId) {
                if (role === 'customer') {
                    navigationRef.navigate('JobStatusDetail', { jobId });
                } else if (role === 'worker') {
                    navigationRef.navigate('ActiveJob', { jobId });
                }
            }
        });

        return () => sub.remove();
    }, [isHydrated]);

    const renderNavigator = () => {
        if (!isHydrated) return <View style={{ flex: 1, backgroundColor: ZarvaTheme.colors.background }} />;

        if (!isAuthenticated || !user) return <AuthNavigator />;

        if (!user.active_role) {
            return (
                <Stack.Navigator screenOptions={{ headerShown: false }}>
                    <Stack.Screen name="RoleSelection" component={RoleSelection} />
                </Stack.Navigator>
            );
        }

        const role = user.active_role;
        const onboardingDone = user.onboarding_complete ?? true;

        if (role === 'worker' && !onboardingDone) return <OnboardingNavigator />;
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
