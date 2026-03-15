/**
 * src/navigation/CustomerNavigator.jsx
 * Bottom tabs: Home | My Jobs | Profile
 * RULE: Zero worker screens here.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import HomeScreen from '@jobs/screens/CustomerHomeScreen';
import MyJobsScreen from '@jobs/screens/MyJobsScreen';
import ProfileScreen from '@customer/screens/CustomerProfileScreen';
import PremiumTabBar from '@shared/ui/PremiumTabBar';

const Tab = createBottomTabNavigator();

const icon = (label) => ({ color }) =>
    <Text style={{ color, fontSize: 20 }}>{label}</Text>;

export default function CustomerNavigator() {
    return (
        <Tab.Navigator
            tabBar={props => <PremiumTabBar {...props} />}
            screenOptions={{
                headerShown: false,
            }}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{ tabBarIcon: icon('🏠'), tabBarLabel: 'Home' }}
            />
            <Tab.Screen
                name="MyJobs"
                component={MyJobsScreen}
                options={{ tabBarIcon: icon('📋'), tabBarLabel: 'My Jobs' }}
            />
            <Tab.Screen
                name="Profile"
                component={ProfileScreen}
                options={{ tabBarIcon: icon('👤'), tabBarLabel: 'Profile' }}
            />
        </Tab.Navigator>
    );
}
