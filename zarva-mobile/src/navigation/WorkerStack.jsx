/**
 * src/navigation/WorkerStack.jsx
 * Wraps the BottomTabs and the full-screen flow screens (Job Details, Active Job, Earnings)
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import WorkerNavigator from './WorkerNavigator';

import JobDetailPreviewScreen from '@worker/screens/JobDetailPreviewScreen';
import ActiveJobScreen from '@inspection/screens/ActiveJobScreen';
import MaterialDeclarationScreen from '@inspection/screens/MaterialDeclarationScreen';
import JobCompleteSummaryScreen from '@inspection/screens/JobCompleteSummaryScreen';
import EarningsScreen from '@worker/screens/WorkerEarningsScreen';
import WorkerWalletScreen from '@worker/screens/WorkerWalletScreen';
import WorkerTransactionHistoryScreen from '@worker/screens/WorkerTransactionHistoryScreen';
import WorkerWithdrawScreen from '@worker/screens/WorkerWithdrawScreen';
import WorkerBankAccountsScreen from '@worker/screens/WorkerBankAccountsScreen';
import AddBankAccountScreen from '@worker/screens/AddBankAccountScreen';
import AlertPreferencesScreen from '@worker/screens/AlertPreferencesScreen';
import WorkerReputationScreen from '@customer/screens/WorkerReputationScreen';
import ChatScreen from '@customer/screens/ChatScreen';
import SupportNavigator from '@customer/screens/SupportNavigator';
import ExtensionRequestScreen from '@inspection/components/ExtensionRequestSheet';

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
