/**
 * src/navigation/CustomerStack.jsx
 * Wraps the BottomTabs and the full-screen flow screens (Job Creation, Tracking, Payment, Rating)
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CustomerNavigator from './CustomerNavigator';

import DynamicQuestionsScreen from '@shared/screens/customer/DynamicQuestionsScreen';
import PriceEstimateScreen from '@shared/screens/customer/PriceEstimateScreen';
import LocationScheduleScreen from '@shared/screens/customer/LocationScheduleScreen';
import SearchingScreen from '@shared/screens/customer/SearchingScreen';
import JobStatusDetailScreen from '@shared/screens/customer/JobStatusDetailScreen';
import BillReviewScreen from '@shared/screens/customer/BillReviewScreen';
import PaymentConfirmScreen from '@shared/screens/customer/PaymentConfirmScreen';
import PaymentScreen from '@shared/screens/customer/PaymentScreen';
import RatingScreen from '@shared/screens/customer/RatingScreen';
import WorkerReputationScreen from '@shared/screens/customer/WorkerReputationScreen';
import EditJobScreen from '@shared/screens/customer/EditJobScreen';
import CreateCustomJobScreen from '@shared/screens/customer/CreateCustomJobScreen';
import MyCustomRequestsScreen from '@shared/screens/customer/MyCustomRequestsScreen';
import ChatScreen from '@shared/screens/shared/ChatScreen';
import SupportNavigator from '@shared/screens/shared/support/SupportNavigator';

const Stack = createStackNavigator();

export default function CustomerStack() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false, presentation: 'card' }}>
            {/* The base tabs */}
            <Stack.Screen name="CustomerTabs" component={CustomerNavigator} />

            {/* Full screen flows layered on top of tabs */}
            <Stack.Screen name="DynamicQuestions" component={DynamicQuestionsScreen} />
            <Stack.Screen name="PriceEstimate" component={PriceEstimateScreen} />
            <Stack.Screen name="LocationSchedule" component={LocationScheduleScreen} />
            <Stack.Screen name="Searching" component={SearchingScreen} />
            <Stack.Screen name="JobStatusDetail" component={JobStatusDetailScreen} />
            <Stack.Screen name="BillReview" component={BillReviewScreen} />
            <Stack.Screen name="PaymentConfirm" component={PaymentConfirmScreen} />
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="Rating" component={RatingScreen} />
            <Stack.Screen name="WorkerReputation" component={WorkerReputationScreen} />
            <Stack.Screen name="EditJob" component={EditJobScreen} />
            <Stack.Screen name="CreateCustomJob" component={CreateCustomJobScreen} />
            <Stack.Screen name="MyCustomRequests" component={MyCustomRequestsScreen} />
            <Stack.Screen name="Chat" component={ChatScreen} />
            <Stack.Screen name="Support" component={SupportNavigator} />
        </Stack.Navigator>
    );
}
