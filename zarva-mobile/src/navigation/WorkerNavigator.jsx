/**
 * src/navigation/WorkerNavigator.jsx
 * Bottom tabs: Available Jobs | My Work | Profile
 * RULE: Zero customer screens here.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import WorkerHomeScreen from '../screens/worker/WorkerHomeScreen';
import AvailableJobsScreen from '../screens/worker/AvailableJobsScreen';
import MyWorkScreen from '../screens/worker/MyWorkScreen';
import WorkerProfileScreen from '../screens/worker/WorkerProfileScreen';
import JobAlertBottomSheet from '../components/JobAlertBottomSheet';
import PremiumTabBar from '../components/PremiumTabBar';
import { useNavigation } from '@react-navigation/native';

const Tab = createBottomTabNavigator();

const icon = (label) => ({ color }) =>
    <Text style={{ color, fontSize: 20 }}>{label}</Text>;

export default function WorkerNavigator() {
    const navigation = useNavigation();
    return (
        <>
            <Tab.Navigator
                tabBar={props => <PremiumTabBar {...props} />}
                screenOptions={{
                    headerShown: false,
                }}
            >
                <Tab.Screen
                    name="WorkerHome"
                    component={WorkerHomeScreen}
                    options={{ tabBarIcon: icon('🏠'), tabBarLabel: 'Home' }}
                />
                <Tab.Screen
                    name="AvailableJobs"
                    component={AvailableJobsScreen}
                    options={{ tabBarIcon: icon('💎'), tabBarLabel: 'Jobs' }}
                />
                <Tab.Screen
                    name="MyWork"
                    component={MyWorkScreen}
                    options={{ tabBarIcon: icon('⚒️'), tabBarLabel: 'History' }}
                />
                <Tab.Screen
                    name="WorkerProfile"
                    component={WorkerProfileScreen}
                    options={{ tabBarIcon: icon('👤'), tabBarLabel: 'Profile' }}
                />
            </Tab.Navigator>
            <JobAlertBottomSheet navigation={navigation} />
        </>
    );
}
