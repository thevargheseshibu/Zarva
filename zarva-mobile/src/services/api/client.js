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

// ── Response interceptor: handle 401 / 429 & Retry ────────────────────────
apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error?.response?.status;
        const originalRequest = error.config;

        // Auto-retry network errors or 5xx server errors once (Issue #45)
        if ((!status || status >= 500) && originalRequest && !originalRequest._retry) {
            originalRequest._retry = true;
            try {
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
        } else if (error?.response?.data?.message && status !== 401) {
            // Propagate specific server rejections to the user UI natively (Issue #46)
            Alert.alert('Error', error.response.data.message, [{ text: 'OK' }]);
        }

        return Promise.reject(error);
    }
);

export default apiClient;
