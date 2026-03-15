/**
 * src/navigation/WorkerStack.jsx
 * Wraps the BottomTabs and the full-screen flow screens (Job Details, Active Job, Earnings)
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WorkerNavigator from './WorkerNavigator';

import JobDetailPreviewScreen from '@shared/screens/worker/JobDetailPreviewScreen';
import ActiveJobScreen from '@shared/screens/worker/ActiveJobScreen';
import MaterialDeclarationScreen from '@shared/screens/worker/MaterialDeclarationScreen';
import JobCompleteSummaryScreen from '@shared/screens/worker/JobCompleteSummaryScreen';
import EarningsScreen from '@shared/screens/worker/EarningsScreen';
import WorkerWalletScreen from '@shared/screens/worker/WorkerWalletScreen';
import WorkerTransactionHistoryScreen from '@shared/screens/worker/WorkerTransactionHistoryScreen';
import WorkerWithdrawScreen from '@shared/screens/worker/WorkerWithdrawScreen';
import WorkerBankAccountsScreen from '@shared/screens/worker/WorkerBankAccountsScreen';
import AddBankAccountScreen from '@shared/screens/worker/AddBankAccountScreen';
import AlertPreferencesScreen from '@shared/screens/worker/AlertPreferencesScreen';
import WorkerReputationScreen from '@shared/screens/customer/WorkerReputationScreen';
import ChatScreen from '@shared/screens/shared/ChatScreen';
import SupportNavigator from '@shared/screens/shared/support/SupportNavigator';
import ExtensionRequestScreen from '@shared/screens/worker/ExtensionRequestScreen';

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
