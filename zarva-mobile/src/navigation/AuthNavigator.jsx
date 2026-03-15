/**
 * src/navigation/AuthNavigator.jsx
 * Stack: Splash → Language → Phone → OTP → RoleSelection
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SplashScreen from '@shared/screens/auth/SplashScreen';
import LanguageScreen from '@shared/screens/auth/LanguageScreen';
import PhoneScreen from '@shared/screens/auth/PhoneScreen';
import OTPScreen from '@shared/screens/auth/OTPScreen';

const Stack = createStackNavigator();

export default function AuthNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Language" component={LanguageScreen} />
            <Stack.Screen name="Phone" component={PhoneScreen} />
            <Stack.Screen name="OTP" component={OTPScreen} />
        </Stack.Navigator>
    );
}
