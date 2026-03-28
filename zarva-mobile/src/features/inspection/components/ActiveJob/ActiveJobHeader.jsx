import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import StatusPill from '@shared/ui/StatusPill';

export function ActiveJobHeader({ styles, navigation, status, chatUnread, handleChatPress }) {
    return (
        <View style={styles.header}>
            <TouchableOpacity 
                style={styles.headerBtn} 
                onPress={() => navigation.goBack()}
            >
                <Text style={styles.headerBtnTxt}>←</Text>
            </TouchableOpacity>

            <View style={styles.headerCenter}>
                <Text style={styles.headerTitle}>ACTIVE SESSION</Text>
                <View style={styles.statusPillWrap}>
                    <StatusPill status={status} />
                </View>
            </View>

            <TouchableOpacity 
                style={styles.chatBtn} 
                onPress={handleChatPress}
            >
                <Text style={{ fontSize: 24 }}>💬</Text>
                {chatUnread > 0 && (
                    <View style={styles.badge}>
                        <Text style={styles.badgeTxt}>{chatUnread}</Text>
                    </View>
                )}
            </TouchableOpacity>
        </View>
    );
}
