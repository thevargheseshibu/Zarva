/**
 * src/navigation/WorkerNavigator.jsx
 * Bottom tabs: Available Jobs | My Work | Profile
 * RULE: Zero customer screens here.
 */
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { colors } from '../design-system/tokens';
import WorkerHomeScreen from '../screens/worker/WorkerHomeScreen';
import AvailableJobsScreen from '../screens/worker/AvailableJobsScreen';
import MyWorkScreen from '../screens/worker/MyWorkScreen';
import WorkerProfileScreen from '../screens/worker/WorkerProfileScreen';

const Tab = createBottomTabNavigator();

const icon = (label) => ({ color }) =>
    <Text style={{ color, fontSize: 20 }}>{label}</Text>;

export default function WorkerNavigator() {
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
                name="WorkerHome"
                component={WorkerHomeScreen}
                options={{ tabBarIcon: icon('🏠'), tabBarLabel: 'Home' }}
            />
            <Tab.Screen
                name="AvailableJobs"
                component={AvailableJobsScreen}
                options={{ tabBarIcon: icon('🔍'), tabBarLabel: 'Jobs' }}
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
    );
}
