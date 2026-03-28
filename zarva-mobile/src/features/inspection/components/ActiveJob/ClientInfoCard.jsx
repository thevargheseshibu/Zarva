import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

export function ClientInfoCard({ styles, job, handleCall, handleNavigate }) {
    return (
        <View style={styles.clientCard}>
            <View style={styles.clientRow}>
                <View style={styles.clientAvatar}>
                    <Text style={styles.avatarTxt}>
                        {(job?.customer_name || 'C').charAt(0).toUpperCase()}
                    </Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.clientLabel}>CLIENT IDENTIFIED</Text>
                    <Text style={styles.clientName}>{job?.customer_name || 'Customer'}</Text>
                    <Text style={styles.clientCat}>Service Category: {job?.category || 'General Repair'}</Text>
                </View>
                <TouchableOpacity style={styles.callChip} onPress={handleCall}>
                    <Text style={{ fontSize: 16 }}>📞</Text>
                    <Text style={styles.callChipTxt}>Call</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.addrRow}>
                <Text style={{ fontSize: 16, marginRight: 8, color: '#F59E0B' }}>📍</Text>
                <Text style={styles.addrTxt} numberOfLines={2}>
                    {job?.address || 'Service Location Not Provided'}
                </Text>
                <TouchableOpacity onPress={handleNavigate}>
                    <Text style={styles.navChip}>NAVIGATE</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}
