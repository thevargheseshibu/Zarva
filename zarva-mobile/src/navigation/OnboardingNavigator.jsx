import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import OnboardingWelcome from '../screens/worker/OnboardingWelcome';

const Stack = createStackNavigator();

export default function OnboardingNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="OnboardingWelcome" component={OnboardingWelcome} />
        </Stack.Navigator>
    );
}
