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
        <NavigationContainer theme={ZarvaTheme}>
            {renderNavigator()}
        </NavigationContainer>
    );
}
