/**
 * src/components/GlobalLoader.jsx
 * 
 * Top-level blocking loader that listens to useUIStore.
 */
import React from 'react';
import ZLoader from './ZLoader';
import { useUIStore } from '@shared/hooks/uiStore';

export default function GlobalLoader() {
    const isLoading = useUIStore(state => state.isLoading);
    const loadingMessage = useUIStore(state => state.loadingMessage);

    if (!isLoading) return null;

    return (
        <ZLoader
            fullScreen
            visible={isLoading}
            message={loadingMessage}
        />
    );
}
