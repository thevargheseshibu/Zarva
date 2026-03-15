import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import SupportHomeScreen from '@customer/screens/SupportScreen';
import SelectJobScreen from '@customer/screens/SelectJobScreen';
import CreateTicketScreen from '@customer/screens/CreateTicketScreen';
import TicketListScreen from '@customer/screens/TicketListScreen';
import TicketChatScreen from '@customer/screens/TicketChatScreen';

const Stack = createStackNavigator();

export default function SupportNavigator() {
    return (
        <Stack.Navigator screenOptions={{ headerShown: false, presentation: 'card' }}>
            <Stack.Screen name="SupportHome" component={SupportHomeScreen} />
            <Stack.Screen name="SelectJob" component={SelectJobScreen} />
            <Stack.Screen name="CreateTicket" component={CreateTicketScreen} />
            <Stack.Screen name="TicketList" component={TicketListScreen} />
            <Stack.Screen name="TicketChat" component={TicketChatScreen} />
        </Stack.Navigator>
    );
}
