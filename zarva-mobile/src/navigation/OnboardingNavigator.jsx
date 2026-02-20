/**
 * src/navigation/OnboardingNavigator.jsx
 * Stack navigator for workers who haven't completed onboarding.
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OnboardingWelcome from '../screens/worker/OnboardingWelcome';
import OnboardingDocuments from '../screens/worker/OnboardingDocuments';

const Stack = createStackNavigator();

export default function OnboardingNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="OnboardingWelcome" component={OnboardingWelcome} />
            <Stack.Screen name="OnboardingDocuments" component={OnboardingDocuments} />
        </Stack.Navigator>
    );
}
