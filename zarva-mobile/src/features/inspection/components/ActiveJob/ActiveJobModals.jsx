import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import PremiumButton from '@shared/ui/PremiumButton';

export function ActiveJobModals({ 
    styles, tTheme, stopSheetVisible, setStopSheetVisible, handlePauseResume, handleReschedule, 
    materialModalVisible, setMaterialModalVisible, materialData, setMaterialData, handleSubmitMaterials, actionLoading 
}) {
    return (
        <>
            {/* STOP/PAUSE SHEET */}
            <Modal
                visible={stopSheetVisible}
                transparent
                animationType="slide"
                onRequestClose={() => setStopSheetVisible(false)}
            >
                <View style={styles.sheetOverlay}>
                    <View style={styles.sheetContainer}>
                        <Text style={styles.sheetTitle}>Manage Session</Text>
                        <Text style={styles.sheetSub}>If you need a break or can't finish today, choose an option below.</Text>
                        
                        <View style={{ gap: 12, marginBottom: 24 }}>
                            <TouchableOpacity style={styles.sheetChoiceCard} onPress={() => handlePauseResume('pause')}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: tTheme.status?.warning?.base + '15', justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 20 }}>⏸</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sheetChoiceTitle}>Pause Session</Text>
                                    <Text style={styles.sheetChoiceSub}>Stop the timer for a lunch or material break.</Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity style={styles.sheetChoiceCard} onPress={handleReschedule}>
                                <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#8B5CF615', justifyContent: 'center', alignItems: 'center' }}>
                                    <Text style={{ fontSize: 20 }}>📅</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.sheetChoiceTitle}>Reschedule Session</Text>
                                    <Text style={styles.sheetChoiceSub}>Move the work to another time or day.</Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity style={styles.sheetCancel} onPress={() => setStopSheetVisible(false)}>
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
