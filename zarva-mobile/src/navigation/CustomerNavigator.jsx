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

const Tab = createBottomTabNavigator();

const icon = (label) => ({ color }) =>
    <Text style={{ color, fontSize: 20 }}>{label}</Text>;

export default function CustomerNavigator() {
    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarStyle: {
                    backgroundColor: colors.bg.elevated,
                    borderTopColor: colors.bg.surface,
                    height: 62,
                },
                tabBarActiveTintColor: colors.gold.primary,
                tabBarInactiveTintColor: colors.text.muted,
                tabBarLabelStyle: { fontSize: 11, marginBottom: 6 },
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
