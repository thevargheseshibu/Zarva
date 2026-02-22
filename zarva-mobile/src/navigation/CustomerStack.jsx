/**
 * src/navigation/CustomerStack.jsx
 * Wraps the BottomTabs and the full-screen flow screens (Job Creation, Tracking, Payment, Rating)
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import CustomerNavigator from './CustomerNavigator';

import DynamicQuestionsScreen from '../screens/customer/DynamicQuestionsScreen';
import PriceEstimateScreen from '../screens/customer/PriceEstimateScreen';
import LocationScheduleScreen from '../screens/customer/LocationScheduleScreen';
import SearchingScreen from '../screens/customer/SearchingScreen';
import JobStatusDetailScreen from '../screens/customer/JobStatusDetailScreen';
import PaymentScreen from '../screens/customer/PaymentScreen';
import RatingScreen from '../screens/customer/RatingScreen';
import WorkerReputationScreen from '../screens/customer/WorkerReputationScreen';

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
            <Stack.Screen name="Payment" component={PaymentScreen} />
            <Stack.Screen name="Rating" component={RatingScreen} />
            <Stack.Screen name="WorkerReputation" component={WorkerReputationScreen} />
        </Stack.Navigator>
    );
}
