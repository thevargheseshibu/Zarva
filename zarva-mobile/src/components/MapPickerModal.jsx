import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';
import { colors, spacing, radius } from '../design-system/tokens';

export default function MapPickerModal({ visible, onClose, onSelectLocation, initialLocation }) {
    const [region, setRegion] = useState(null);
    const [markerCoord, setMarkerCoord] = useState(null);
    const [loading, setLoading] = useState(true);
    const webviewRef = useRef(null);

    useEffect(() => {
        if (visible) {
            setLoading(true);
            if (initialLocation && initialLocation.latitude && initialLocation.longitude) {
                const loc = { latitude: initialLocation.latitude, longitude: initialLocation.longitude };
                setRegion(loc);
                setMarkerCoord(loc);
                setLoading(false);
            } else {
                (async () => {
                    const { status } = await Location.requestForegroundPermissionsAsync();
                    if (status === 'granted') {
                        try {
                            const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                            const loc = { latitude: location.coords.latitude, longitude: location.coords.longitude };
                            setRegion(loc);
                            setMarkerCoord(loc);
                        } catch (e) {
                            console.warn('Failed to get current location', e);
                            const fallback = { latitude: 9.9312, longitude: 76.2673 };
                            setRegion(fallback);
                            setMarkerCoord(fallback);
                        }
                    } else {
                        const fallback = { latitude: 9.9312, longitude: 76.2673 };
                        setRegion(fallback);
                        setMarkerCoord(fallback);
                    }
                    setLoading(false);
                })();
            }
        }
    }, [visible, initialLocation]);

    const handleConfirm = async () => {
        if (!markerCoord) return;

        try {
            const [addressArr] = await Location.reverseGeocodeAsync({
                latitude: markerCoord.latitude,
                longitude: markerCoord.longitude
            });

            let addressText = 'Unknown Location';
            if (addressArr) {
                const parts = [addressArr.name, addressArr.city || addressArr.subregion, addressArr.region].filter(Boolean);
                addressText = parts.join(', ');
            }

            onSelectLocation({
                latitude: markerCoord.latitude,
                longitude: markerCoord.longitude,
                address: addressText
            });
        } catch (e) {
            onSelectLocation({
                latitude: markerCoord.latitude,
                longitude: markerCoord.longitude,
                address: 'Selected Location'
            });
        }
    };

    const handleMessage = (event) => {
        try {
            const data = JSON.parse(event.nativeEvent.data);
            if (data.type === 'updateLocation') {
                setMarkerCoord({ latitude: data.lat, longitude: data.lng });
            }
        } catch (err) {
            console.error('Map message parse error', err);
        }
    };

    const generateMapHTML = (lat, lng) => `
        <!DOCTYPE html>
        <html>
        <head>
            <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" 
                  integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" 
                  crossorigin=""/>
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" 
                    integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" 
                    crossorigin=""></script>
            <style>
                body { padding: 0; margin: 0; }
                html, body, #map { height: 100%; width: 100%; }
                .leaflet-control-zoom { display: none; }
            </style>
        </head>
        <body>
            <div id="map"></div>
            <script>
                var map = L.map('map').setView([${lat}, ${lng}], 15);
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
                }).addTo(map);

                var marker = L.marker([${lat}, ${lng}], {draggable: true}).addTo(map);

                // Update react native when marker dragged
                marker.on('dragend', function(e) {
                    var position = marker.getLatLng();
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'updateLocation',
                        lat: position.lat,
                        lng: position.lng
                    }));
                });

                // Move marker when map clicked
                map.on('click', function(e) {
                    var position = e.latlng;
                    marker.setLatLng(position);
                    window.ReactNativeWebView.postMessage(JSON.stringify({
                        type: 'updateLocation',
                        lat: position.lat,
                        lng: position.lng
                    }));
                });
            </script>
        </body>
        </html>
    `;

    return (
        <Modal visible={visible} animationType="slide" transparent>
            <View style={styles.modalBg}>
                <View style={styles.container}>
                    <View style={styles.header}>
                        <Text style={styles.title}>Select Location</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                            <Text style={styles.closeTxt}>✕</Text>
                        </TouchableOpacity>
                    </View>

                    {loading || !region ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.accent.primary} />
                            <Text style={styles.loadingTxt}>Fetching map...</Text>
                        </View>
                    ) : (
                        <View style={styles.mapWrap}>
                            <WebView
                                ref={webviewRef}
                                source={{ html: generateMapHTML(region.latitude, region.longitude) }}
                                style={styles.map}
                                onMessage={handleMessage}
                                scrollEnabled={false}
                                bounces={false}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                            />
                            <View style={styles.hintBox}>
                                <Text style={styles.hintTxt}>Tap on the map or drag the pin to set your location</Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.footer}>
                        <TouchableOpacity
                            style={[styles.confirmBtn, (!markerCoord || loading) && styles.confirmBtnDisabled]}
                            disabled={!markerCoord || loading}
                            onPress={handleConfirm}
                        >
                            <Text style={styles.confirmTxt}>Confirm Location</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    container: { backgroundColor: colors.bg.primary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, height: '80%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg, borderBottomWidth: 1, borderBottomColor: colors.bg.surface },
    title: { color: colors.text.primary, fontSize: 18, fontWeight: '700' },
    closeBtn: { padding: spacing.xs },
    closeTxt: { color: colors.text.muted, fontSize: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.md },
    loadingTxt: { color: colors.text.muted, fontSize: 14 },
    mapWrap: { flex: 1, position: 'relative' },
    map: { flex: 1 },
    hintBox: { position: 'absolute', top: spacing.md, alignSelf: 'center', backgroundColor: colors.bg.elevated, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.full, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
    hintTxt: { color: colors.text.primary, fontSize: 12, fontWeight: '600' },
    footer: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.bg.surface, backgroundColor: colors.bg.primary },
    confirmBtn: { backgroundColor: colors.accent.primary, paddingVertical: spacing.md, borderRadius: radius.md, alignItems: 'center' },
    confirmBtnDisabled: { opacity: 0.5 },
    confirmTxt: { color: colors.bg.primary, fontSize: 16, fontWeight: '700' }
});
