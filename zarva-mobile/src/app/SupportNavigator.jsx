import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';

import SupportHomeScreen from './SupportHomeScreen';
import SelectJobScreen from './SelectJobScreen';
import CreateTicketScreen from './CreateTicketScreen';
import TicketListScreen from './TicketListScreen';
import TicketChatScreen from './TicketChatScreen';

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
