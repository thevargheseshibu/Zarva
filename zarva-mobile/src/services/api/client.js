/**
 * src/services/api/client.js
 *
 * Axios instance for ZARVA API.
 * - JWT Bearer token injected from authStore
 * - 401 → logout()
 * - 429 → Alert 'Too many requests'
 */
import axios from 'axios';
import { Alert } from 'react-native';
import { useAuthStore } from '../../stores/authStore';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

const apiClient = axios.create({
    baseURL: BASE_URL,
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach JWT ─────────────────────────────────────────
apiClient.interceptors.request.use(
    (config) => {
        const token = useAuthStore.getState().token;
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// ── Response interceptor: handle 401 / 429 ───────────────────────────────────
apiClient.interceptors.response.use(
    (response) => response,
    (error) => {
        const status = error?.response?.status;

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

        return Promise.reject(error);
    }
);

export default apiClient;
