/**
 * src/navigation/AuthNavigator.jsx
 * Stack: Splash → Language → Phone → OTP → RoleSelection
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SplashScreen from '@auth/screens/SplashScreen';
import LanguageScreen from '@auth/screens/LanguageScreen';
import PhoneScreen from '@auth/screens/PhoneScreen';
import OTPScreen from '@auth/screens/OTPScreen';

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
