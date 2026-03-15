/**
 * src/navigation/CustomerStack.jsx
 * Wraps the BottomTabs and the full-screen flow screens (Job Creation, Tracking, Payment, Rating)
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CustomerNavigator from './CustomerNavigator';

import DynamicQuestionsScreen from '@jobs/screens/DynamicQuestionsScreen';
import PriceEstimateScreen from '@jobs/screens/PriceEstimateScreen';
import LocationScheduleScreen from '@jobs/screens/LocationScheduleScreen';
import SearchingScreen from '@jobs/screens/SearchingScreen';
import JobStatusDetailScreen from '@jobs/screens/JobStatusDetailScreen';
import BillReviewScreen from '@payment/screens/BillReviewScreen';
import PaymentConfirmScreen from '@payment/screens/PaymentConfirmScreen';
import PaymentScreen from '@payment/screens/PaymentScreen';
import RatingScreen from '@payment/screens/RatingScreen';
import WorkerReputationScreen from '@customer/screens/WorkerReputationScreen';
import EditJobScreen from '@jobs/screens/EditJobScreen';
import CreateCustomJobScreen from '@jobs/screens/CreateCustomJobScreen';
import MyCustomRequestsScreen from '@jobs/screens/MyCustomRequestsScreen';
import ChatScreen from '@customer/screens/ChatScreen';
import SupportNavigator from '@app/SupportNavigator';

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
