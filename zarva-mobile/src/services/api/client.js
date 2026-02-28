/**
 * src/services/api/client.js
 *
 * Axios instance for ZARVA API.
 * - JWT Bearer token injected from authStore
 * - 401 → logout()
 * - 429 → Alert 'Too many requests'
 */
import axios from 'axios';
import { Alert, Platform } from 'react-native';
import { useAuthStore } from '../../stores/authStore';
import { useUIStore } from '../../stores/uiStore';
import Constants from 'expo-constants';

let BASE_URL = process.env.EXPO_PUBLIC_API_URL || '';

// In dev, we prioritize resolving the machine IP for physical devices
if (__DEV__) {
    const isIpDefined = BASE_URL && !BASE_URL.includes('localhost') && !BASE_URL.includes('127.0.0.1');

    if (!isIpDefined) {
        const expoConfig = Constants?.expoConfig || Constants?.manifest || {};
        const hostUri = expoConfig.hostUri;
        const debuggerHost = expoConfig.debuggerHost;
        
        let detectedIP = null;
        if (hostUri) detectedIP = hostUri.split(':')[0];
        else if (debuggerHost) detectedIP = debuggerHost.split(':')[0];

        if (detectedIP && detectedIP !== 'localhost' && detectedIP !== '127.0.0.1') {
            BASE_URL = `http://${detectedIP}:3000`;
            console.log('[api/client] 🚀 Auto-Resolved to Metro machine IP:', BASE_URL);
        } else if (Platform.OS === 'android') {
            BASE_URL = 'http://10.0.2.2:3000';
            console.log('[api/client] 🤖 Fallback to Android Emulator host alias:', BASE_URL);
        } else {
            BASE_URL = 'http://localhost:3000';
            console.log('[api/client] 🔌 Fallback to localhost:', BASE_URL);
        }
    } else {
        console.log('[api/client] ✅ Using provided .env IP URL:', BASE_URL);
    }
} else if (!BASE_URL) {
    BASE_URL = 'http://localhost:3000';
}

const apiClient = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach JWT & Global Loader ─────────────────────────
apiClient.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }

        // Show Global Loader for mutation requests unless explicitly opted-out or specifically excluded
        const method = config.method?.toLowerCase();
        const isMutation = ['post', 'put', 'delete'].includes(method);
        const isBackground = config.url?.includes('/location') || config.url?.includes('/presence') || config.url?.includes('/metrics');

        if (isMutation && !isBackground && config.useLoader !== false) {
            useUIStore.getState().showLoader(config.loaderMessage || 'Processing...');
        }

        return config;
    },
    (error) => {
        useUIStore.getState().hideLoader();
        return Promise.reject(error);
    }
);

// ── Response interceptor: handle 401 / 429 & Retry & Loader ──────────────────
apiClient.interceptors.response.use(
    (response) => {
        useUIStore.getState().hideLoader();
        return response;
    },
    async (error) => {
        useUIStore.getState().hideLoader();

        const status = error?.response?.status;
        const originalRequest = error.config;

        // Auto-retry network errors or 5xx server errors once (Issue #45)
        if ((!status || status >= 500) && originalRequest && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
                // Restore loader for retry if it was active
                if (originalRequest.useLoader !== false) {
                    const method = originalRequest.method?.toLowerCase();
                    if (['post', 'put', 'delete'].includes(method)) {
                        useUIStore.getState().showLoader(originalRequest.loaderMessage || 'Retrying...');
                    }
                }
                return await apiClient(originalRequest);
            } catch (retryError) {
                return Promise.reject(retryError);
            }
        }

        if (status === 401) {
            useAuthStore.getState().logout();
        }

        if (status === 429) {
            Alert.alert(
                'Too Many Requests',
                'You\'ve made too many requests. Please wait a moment and try again.',
                [{ text: 'OK' }]
            );
        }
        else if (error?.response?.data?.message && status >= 500) {
            Alert.alert('Server Error', error.response?.data?.message, [{ text: 'OK' }]);
        }

        return Promise.reject(error);
    }
);

export default apiClient;
