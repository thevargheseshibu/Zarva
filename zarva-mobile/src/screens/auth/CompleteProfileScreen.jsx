import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, ScrollView, Alert, TouchableOpacity, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';
import apiClient from '../../services/api/client';
import { useAuthStore } from '../../stores/authStore';
import { useT } from '../../hooks/useT';

export default function CompleteProfileScreen() {
    const { user, token, login } = useAuthStore();
    const t = useT();
    const [name, setName] = useState('');
    const [dob, setDob] = useState('');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [dobDate, setDobDate] = useState(new Date());
    const [loading, setLoading] = useState(false);

    const handleDateChange = (event, selectedDate) => {
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            setDobDate(selectedDate);
            // Format as YYYY-MM-DD for the backend
            const dd = String(selectedDate.getDate()).padStart(2, '0');
            const mm = String(selectedDate.getMonth() + 1).padStart(2, '0'); // January is 0!
            const yyyy = selectedDate.getFullYear();
            setDob(`${yyyy}-${mm}-${dd}`);
        }
    };

    const isValid = name.trim().length >= 2 && dob.length === 10;

    const handleContinue = async () => {
        if (!isValid) return;
        setLoading(true);
        try {
            const res = await apiClient.post('/api/me/profile', { name: name.trim(), dob });
            const updatedProfile = res.data?.user || res.data;
            login({ ...user, ...updatedProfile }, token);
        } catch (err) {
            console.error('Profile update failed:', err);
            Alert.alert('Error', err.response?.data?.message || 'Failed to update profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView contentContainerStyle={styles.screen}>
            <View style={styles.header}>
                <Text style={styles.title}>Create your Profile</Text>
                <Text style={styles.sub}>Let's get to know you better before getting started.</Text>
            </View>

            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Full Name</Text>
                <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="e.g. Rajan Kumar"
                    placeholderTextColor={colors.text.muted}
                    autoCapitalize="words"
                />
            </View>

            <View style={styles.fieldGroup}>
                <Text style={styles.label}>Date of Birth</Text>
                <TouchableOpacity
                    style={styles.input}
                    onPress={() => setShowDatePicker(true)}
                    activeOpacity={0.7}
                >
                    <Text style={{ color: dob ? colors.text.primary : colors.text.muted, fontSize: 18 }}>
                        {dob ? dob.split('-').reverse().join('/') : "DD/MM/YYYY"}
                    </Text>
                </TouchableOpacity>

                {showDatePicker && (
                    <DateTimePicker
                        value={dobDate}
                        mode="date"
                        display="spinner"
                        maximumDate={new Date()}
                        onChange={handleDateChange}
                        textColor={colors.text.primary}
                        themeVariant="dark"
                    />
                )}
            </View>

            <GoldButton
                title={t('continue')}
                disabled={!isValid}
                loading={loading}
                onPress={handleContinue}
                style={{ marginTop: spacing.xl }}
            />
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    screen: { flexGrow: 1, backgroundColor: colors.bg.primary, padding: spacing.xl, justifyContent: 'center', gap: spacing.lg },
    header: { marginBottom: spacing.md },
    title: { color: colors.text.primary, fontSize: 32, fontWeight: '800', marginBottom: spacing.xs },
    sub: { color: colors.text.secondary, fontSize: 16, lineHeight: 24, marginTop: spacing.xs },
    fieldGroup: { gap: spacing.xs },
    label: { color: colors.text.secondary, fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    input: {
        backgroundColor: colors.bg.elevated, borderRadius: radius.md,
        paddingHorizontal: spacing.md, paddingVertical: 16,
        color: colors.text.primary, fontSize: 18, borderWidth: 1, borderColor: colors.bg.surface,
    }
});
