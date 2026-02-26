/**
 * src/navigation/CustomerNavigator.jsx
 * Bottom tabs: Home | My Jobs | Profile
 * RULE: Zero worker screens here.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { colors } from '../design-system/tokens';
import HomeScreen from '../screens/customer/HomeScreen';
import MyJobsScreen from '../screens/customer/MyJobsScreen';
import ProfileScreen from '../screens/customer/CustomerProfileScreen';
import PremiumTabBar from '../components/PremiumTabBar';

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
