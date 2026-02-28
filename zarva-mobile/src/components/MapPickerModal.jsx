import React, { useState, useEffect, useRef } from 'react';
import { useTokens } from '../design-system';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import * as Location from 'expo-location';

export default function MapPickerModal({ visible, onClose, onSelectLocation, initialLocation }) {
    const tTheme = useTokens();
    const styles = React.useMemo(() => createStyles(tTheme), [tTheme]);
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
            <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" crossorigin=""/>
            <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js" crossorigin=""></script>
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
                L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png').addTo(map);
                var marker = L.marker([${lat}, ${lng}], {draggable: true}).addTo(map);
                marker.on('dragend', function(e) {
                    var position = marker.getLatLng();
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'updateLocation', lat: position.lat, lng: position.lng }));
                });
                map.on('click', function(e) {
                    var position = e.latlng;
                    marker.setLatLng(position);
                    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'updateLocation', lat: position.lat, lng: position.lng }));
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
                            <ActivityIndicator size="large" color={tTheme.brand.primary} />
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

const createStyles = (t) => StyleSheet.create({
    modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
    container: { backgroundColor: t.background.app, borderTopLeftRadius: t.radius.xl, borderTopRightRadius: t.radius.xl, height: '80%' },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: t.spacing.lg, borderBottomWidth: 1, borderBottomColor: t.background.surface },
    title: { color: t.text.primary, fontSize: 18, fontWeight: '700' },
    closeBtn: { padding: t.spacing.xs },
    closeTxt: { color: t.text.tertiary, fontSize: 20 },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: t.spacing.md },
    loadingTxt: { color: t.text.tertiary, fontSize: 14 },
    mapWrap: { flex: 1, position: 'relative' },
    map: { flex: 1 },
    hintBox: { position: 'absolute', top: t.spacing.md, alignSelf: 'center', backgroundColor: t.background.surfaceRaised, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm, borderRadius: t.radius.full },
    hintTxt: { color: t.text.primary, fontSize: 12, fontWeight: '600' },
    footer: { padding: t.spacing.lg, borderTopWidth: 1, borderTopColor: t.background.surface, backgroundColor: t.background.app },
    confirmBtn: { backgroundColor: t.brand.primary, paddingVertical: t.spacing.md, borderRadius: t.radius.md, alignItems: 'center' },
    confirmBtnDisabled: { opacity: 0.5 },
    confirmTxt: { color: t.background.app, fontSize: 16, fontWeight: '700' }
});
