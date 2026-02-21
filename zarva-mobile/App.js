/**
 * App.js — ZARVA Mobile entry point
 *
 * Wraps the entire app in:
 *   - GestureHandlerRootView  (required for bottom sheets / gestures)
 *   - QueryClientProvider     (react-query)
 *   - SafeAreaProvider        (safe area insets)
 *   - RootNavigator           (auth-gated navigation)
 */
import 'react-native-gesture-handler';
import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator } from 'react-native';
import RootNavigator from './src/navigation/RootNavigator';
import { useLanguageStore } from './src/i18n';
import apiClient from './src/services/api/client';
import { useJobStore } from './src/stores/jobStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 30_000 },
  },
});

export default function App() {
  const { language, isLoaded, loadLanguage } = useLanguageStore();

  React.useEffect(() => {
    // When the persisted language code hydrating changes, or on first mount,
    // load the actual translation file dictionary into the store.
    loadLanguage(language);
  }, [language]);

  React.useEffect(() => {
    if (isLoaded) {
      // Rehydrate minimizable active job queue on app reopen
      apiClient.get('/api/me/jobs?status=active').then(res => {
        const job = res.data?.jobs?.[0] || res.data?.data?.[0]; // Support multiple payload styles
        if (job) {
          const store = useJobStore.getState();
          store.setActiveJob({ id: job.id, category: job.category });
          store.setSearchPhase(job.status || 'searching');
          store.setCanMinimize(true);
          store.startListening(job.id);
        }
      }).catch(err => { /* Soft ignore on Unauth instances */ });
    }
  }, [isLoaded]);

  if (!isLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0A0F', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#CFA34B" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <StatusBar style="light" backgroundColor="#0A0A0F" />
          <RootNavigator />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
