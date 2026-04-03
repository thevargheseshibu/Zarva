import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput } from 'react-native';
import PremiumButton from '@shared/ui/PremiumButton';

export function ActiveJobModals({ 
    styles, tTheme, stopSheetVisible, setStopSheetVisible, 
    isPauseMode, setIsPauseMode, pauseReason, setPauseReason, 
    rescheduleDate, setRescheduleDate, rescheduleReason, setRescheduleReason, 
    handlePauseSubmit, handleRescheduleSubmit,
    materialModalVisible, setMaterialModalVisible, materialData, setMaterialData, handleSubmitMaterials, actionLoading 
}) {
    
    // Generate the next 7 days dynamically for the calendar
    const dates = useMemo(() => {
        const arr = [];
        for (let i = 1; i <= 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            arr.push(d);
        }
        return arr;
    }, []);

    const timeSlots = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

    const isSameDate = (d1, d2) => d1 && d2 && 
        d1.getFullYear() === d2.getFullYear() && 
        d1.getMonth() === d2.getMonth() && 
        d1.getDate() === d2.getDate();

    const handleDateSelect = (d) => {
        const newDate = new Date(rescheduleDate);
        newDate.setFullYear(d.getFullYear(), d.getMonth(), d.getDate());
        setRescheduleDate(newDate);
    };

    const handleTimeSelect = (timeStr) => {
        const [hours, mins] = timeStr.split(':');
        const newDate = new Date(rescheduleDate);
        newDate.setHours(parseInt(hours, 10), parseInt(mins, 10), 0, 0);
        setRescheduleDate(newDate);
    };

    const closeModals = () => {
        setStopSheetVisible(false);
        setIsPauseMode(null);
    };

    return (
        <>
            {/* STOP/PAUSE SHEET */}
            <Modal
                visible={stopSheetVisible}
                transparent
                animationType="slide"
                onRequestClose={closeModals}
            >
                <View style={styles.sheetOverlay}>
                    <View style={styles.sheetContainer}>
                        
                        {/* VIEW 1: SELECTION MENU */}
                        {!isPauseMode && (
                            <>
                                <Text style={styles.sheetTitle}>Manage Session</Text>
                                <Text style={styles.sheetSub}>If you need a break or can't finish today, choose an option below.</Text>
                                
                                <View style={{ gap: 12, marginBottom: 24 }}>
                                    <TouchableOpacity style={styles.sheetChoiceCard} onPress={() => setIsPauseMode('pause')}>
                                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tTheme.status?.warning?.base + '15', justifyContent: 'center', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 20 }}>⏸</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.sheetChoiceTitle}>Pause Session</Text>
                                            <Text style={styles.sheetChoiceSub}>Stop the timer for a lunch or material break.</Text>
                                        </View>
                                    </TouchableOpacity>

                                    <TouchableOpacity style={styles.sheetChoiceCard} onPress={() => setIsPauseMode('reschedule')}>
                                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#8B5CF615', justifyContent: 'center', alignItems: 'center' }}>
                                            <Text style={{ fontSize: 20 }}>📅</Text>
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.sheetChoiceTitle}>Reschedule Session</Text>
                                            <Text style={styles.sheetChoiceSub}>Move the work to another time or day.</Text>
                                        </View>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}

                        {/* VIEW 2: PAUSE REASON */}
                        {isPauseMode === 'pause' && (
                            <>
                                <Text style={styles.sheetTitle}>Request Pause</Text>
                                <Text style={styles.sheetSub}>Provide a reason for pausing the session.</Text>
                                
                                <TextInput
                                    style={{
                                        backgroundColor: tTheme.background.surfaceRaised, color: tTheme.text.primary,
                                        padding: 16, borderRadius: 12, borderWidth: 1, borderColor: tTheme.border.default,
                                        minHeight: 120, textAlignVertical: 'top', fontSize: 15, marginBottom: 24
                                    }}
                                    placeholder="e.g., Going to buy materials..."
                                    placeholderTextColor={tTheme.text.tertiary}
                                    multiline
                                    value={pauseReason}
                                    onChangeText={setPauseReason}
                                />
                                
                                <PremiumButton
                                    title="Submit Pause Request"
                                    onPress={handlePauseSubmit}
                                    loading={actionLoading}
                                    disabled={!pauseReason?.trim()}
                                />
                            </>
                        )}

                        {/* VIEW 3: RESCHEDULE CALENDAR */}
                        {isPauseMode === 'reschedule' && (
                            <>
                                <Text style={styles.sheetTitle}>Reschedule Session</Text>
                                <Text style={styles.sheetSub}>Select a new date and time to continue the work.</Text>
                                
                                <Text style={{ color: tTheme.text.secondary, fontSize: 11, fontWeight: '800', marginBottom: 8, letterSpacing: 1 }}>SELECT DATE</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
                                    {dates.map((d, i) => {
                                        const selected = isSameDate(d, rescheduleDate);
                                        return (
                                            <TouchableOpacity 
                                                key={i} 
                                                onPress={() => handleDateSelect(d)}
                                                style={{ 
                                                    paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, 
                                                    backgroundColor: selected ? '#8B5CF6' : tTheme.background.surfaceRaised,
                                                    borderWidth: 1, borderColor: selected ? '#8B5CF6' : tTheme.border.default,
                                                    alignItems: 'center'
                                                }}>
                                                <Text style={{ color: selected ? '#FFF' : tTheme.text.secondary, fontSize: 11, fontWeight: '800', textTransform: 'uppercase' }}>
                                                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                                                </Text>
                                                <Text style={{ color: selected ? '#FFF' : tTheme.text.primary, fontSize: 20, fontWeight: '900', marginTop: 4 }}>
                                                    {d.getDate()}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                <Text style={{ color: tTheme.text.secondary, fontSize: 11, fontWeight: '800', marginBottom: 8, letterSpacing: 1 }}>SELECT TIME</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingBottom: 16 }}>
                                    {timeSlots.map((t, i) => {
                                        const slotHour = parseInt(t.split(':')[0], 10);
                                        const selected = rescheduleDate && rescheduleDate.getHours() === slotHour;
                                        const displayTime = slotHour > 12 ? `${slotHour - 12}:00 PM` : (t === '12:00' ? '12:00 PM' : `${t} AM`);
                                        return (
                                            <TouchableOpacity 
                                                key={i} 
                                                onPress={() => handleTimeSelect(t)}
                                                style={{ 
                                                    paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12, 
                                                    backgroundColor: selected ? '#8B5CF6' : tTheme.background.surfaceRaised,
                                                    borderWidth: 1, borderColor: selected ? '#8B5CF6' : tTheme.border.default,
                                                }}>
                                                <Text style={{ color: selected ? '#FFF' : tTheme.text.primary, fontSize: 13, fontWeight: '700' }}>
                                                    {displayTime}
                                                </Text>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>

                                <TextInput
                                    style={{
                                        backgroundColor: tTheme.background.surfaceRaised, color: tTheme.text.primary,
                                        padding: 16, borderRadius: 12, borderWidth: 1, borderColor: tTheme.border.default,
                                        minHeight: 80, textAlignVertical: 'top', fontSize: 15, marginBottom: 16
                                    }}
                                    placeholder="Reason for rescheduling..."
                                    placeholderTextColor={tTheme.text.tertiary}
                                    multiline
                                    value={rescheduleReason}
                                    onChangeText={setRescheduleReason}
                                />
                                
                                <PremiumButton
                                    title="Send Request to Customer"
                                    onPress={handleRescheduleSubmit}
                                    loading={actionLoading}
                                    disabled={!rescheduleReason?.trim()}
                                />
                            </>
                        )}

                        <TouchableOpacity style={[styles.sheetCancel, { marginTop: 12 }]} onPress={closeModals}>
                            <Text style={styles.sheetCancelTxt}>Dismiss</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MATERIAL LOG MODAL */}
            <Modal
                visible={materialModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setMaterialModalVisible(false)}
            >
                <View style={[styles.sheetOverlay, { backgroundColor: 'rgba(0,0,0,0.4)', padding: 16 }]}>
                    <View style={[styles.sheetContainer, { borderRadius: 24 }]}>
                        <Text style={styles.sheetTitle}>Material Settlement</Text>
                        <Text style={styles.sheetSub}>Log all extra parts or materials you purchased for this job.</Text>

                        <ScrollView style={{ maxHeight: 240, marginBottom: 12 }}>
                            {materialData.map((item, i) => (
                                <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                                    <TextInput
                                        style={[styles.formInput, { flex: 2 }]}
                                        placeholder="Item name"
                                        placeholderTextColor={tTheme.text.tertiary}
                                        value={item.name}
                                        onChangeText={(v) => {
                                            const next = [...materialData];
                                            next[i] = { ...next[i], name: v };
                                            setMaterialData(next);
                                        }}
                                    />
                                    <TextInput
                                        style={[styles.formInput, { flex: 1 }]}
                                        placeholder="₹"
                                        placeholderTextColor={tTheme.text.tertiary}
                                        keyboardType="numeric"
                                        value={item.amount}
                                        onChangeText={(v) => {
                                            const next = [...materialData];
                                            next[i] = { ...next[i], amount: v };
                                            setMaterialData(next);
                                        }}
                                    />
                                </View>
                            ))}
                        </ScrollView>

                        <TouchableOpacity 
                            style={{ padding: 12, alignItems: 'center', marginBottom: 12, borderStyle: 'dotted', borderWidth: 1, borderColor: tTheme.brand.primary + '44', borderRadius: 12 }} 
                            onPress={() => setMaterialData([...materialData, { name: '', amount: '' }])}
                        >
                            <Text style={{ color: tTheme.brand.primary, fontWeight: '600' }}>+ Add Item</Text>
                        </TouchableOpacity>

                        <View style={{ gap: 10, marginTop: 12 }}>
                            <PremiumButton
                                title="Submit Materials & Continue"
                                onPress={() => handleSubmitMaterials(false)}
                                loading={actionLoading}
                            />
                            <TouchableOpacity onPress={() => handleSubmitMaterials(true)} style={styles.sheetCancel}>
                                <Text style={styles.sheetCancelTxt}>No Materials — Skip</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
    );
}
