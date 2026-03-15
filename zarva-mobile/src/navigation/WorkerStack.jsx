/**
 * src/navigation/WorkerStack.jsx
 * Wraps the BottomTabs and the full-screen flow screens (Job Details, Active Job, Earnings)
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WorkerNavigator from './WorkerNavigator';

import JobDetailPreviewScreen from '../screens/worker/JobDetailPreviewScreen';
import ActiveJobScreen from '../screens/worker/ActiveJobScreen';
import MaterialDeclarationScreen from '../screens/worker/MaterialDeclarationScreen';
import JobCompleteSummaryScreen from '../screens/worker/JobCompleteSummaryScreen';
import EarningsScreen from '../screens/worker/EarningsScreen';
import WorkerWalletScreen from '../screens/worker/WorkerWalletScreen';
import WorkerTransactionHistoryScreen from '../screens/worker/WorkerTransactionHistoryScreen';
import WorkerWithdrawScreen from '../screens/worker/WorkerWithdrawScreen';
import WorkerBankAccountsScreen from '../screens/worker/WorkerBankAccountsScreen';
import AddBankAccountScreen from '../screens/worker/AddBankAccountScreen';
import AlertPreferencesScreen from '../screens/worker/AlertPreferencesScreen';
import WorkerReputationScreen from '../screens/customer/WorkerReputationScreen';
import ChatScreen from '../screens/shared/ChatScreen';
import SupportNavigator from '../screens/shared/support/SupportNavigator';
import ExtensionRequestScreen from '../screens/worker/ExtensionRequestScreen';

const Stack = createStackNavigator();

export default function WorkerStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false, presentation: 'card' }}>
            {/* The base tabs */}
            <Stack.Screen name="WorkerTabs" component={WorkerNavigator} />

            {/* Full screen flows layered on top of tabs */}
            <Stack.Screen name="JobDetailPreview" component={JobDetailPreviewScreen} />
            <Stack.Screen name="ActiveJob" component={ActiveJobScreen} />
            <Stack.Screen name="MaterialDeclaration" component={MaterialDeclarationScreen} />
            <Stack.Screen name="JobCompleteSummary" component={JobCompleteSummaryScreen} />
            <Stack.Screen name="EarningsDetail" component={EarningsScreen} />
            <Stack.Screen name="WorkerWallet" component={WorkerWalletScreen} />
            <Stack.Screen name="WorkerTransactionHistory" component={WorkerTransactionHistoryScreen} />
            <Stack.Screen name="WorkerWithdraw" component={WorkerWithdrawScreen} />
            <Stack.Screen name="WorkerBankAccounts" component={WorkerBankAccountsScreen} />
            <Stack.Screen name="AddBankAccount" component={AddBankAccountScreen} />
            <Stack.Screen name="AlertPreferences" component={AlertPreferencesScreen} options={{ headerShown: true, title: 'Alert Settings' }} />
            <Stack.Screen name="WorkerReputation" component={WorkerReputationScreen} options={{ headerShown: true, title: 'My Reputation' }} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="ExtensionRequest" component={ExtensionRequestScreen} />
            <Stack.Screen name="Support" component={SupportNavigator} />
        </Stack.Navigator>
    );
}
