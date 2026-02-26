/**
 * src/navigation/WorkerStack.jsx
 * Wraps the BottomTabs and the full-screen flow screens (Job Details, Active Job, Earnings)
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WorkerNavigator from './WorkerNavigator';

import JobDetailPreviewScreen from '../screens/worker/JobDetailPreviewScreen';
import ActiveJobScreen from '../screens/worker/ActiveJobScreen';
import EarningsScreen from '../screens/worker/EarningsScreen';
import AlertPreferencesScreen from '../screens/worker/AlertPreferencesScreen';
import WorkerReputationScreen from '../screens/customer/WorkerReputationScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import SupportNavigator from '../screens/shared/support/SupportNavigator';

const Stack = createStackNavigator();

export default function WorkerStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false, presentation: 'card' }}>
            {/* The base tabs */}
            <Stack.Screen name="WorkerTabs" component={WorkerNavigator} />

            {/* Full screen flows layered on top of tabs */}
            <Stack.Screen name="JobDetailPreview" component={JobDetailPreviewScreen} />
            <Stack.Screen name="ActiveJob" component={ActiveJobScreen} />
            <Stack.Screen name="EarningsDetail" component={EarningsScreen} />
            <Stack.Screen name="AlertPreferences" component={AlertPreferencesScreen} options={{ headerShown: true, title: 'Alert Settings' }} />
            <Stack.Screen name="WorkerReputation" component={WorkerReputationScreen} options={{ headerShown: true, title: 'My Reputation' }} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="Support" component={SupportNavigator} />
        </Stack.Navigator>
    );
}
