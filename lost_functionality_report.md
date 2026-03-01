# Lost Functionality Report

### zarva-mobile/src/screens/worker/WorkerHomeScreen.jsx
- [RESTORED] apiClient.get(`/api/reviews/worker/${user.id}` — present
- [RESTORED] navigation.navigate('WorkerReputation') — present
- [RESTORED] Alert.alert('Sync Error') — present, now uses t('sync_error')

### zarva-mobile/src/screens/worker/WorkerProfileScreen.jsx
- [RESTORED] apiClient.get('/api/worker/skills') — used for skills catalog (replaces /api/jobs/config for this screen)
- [RESTORED] POST /api/worker/onboarding/skills — route added; skills update works
- [RESTORED] apiClient.put('/api/worker/availability') — present
- [RESTORED] navigation.navigate('AlertPreferences') — present
- [RESTORED] navigation.navigate('Support') — present
- [RESTORED] Location.requestForegroundPermissionsAsync — added in useEffect
- [RESTORED] Location.getCurrentPositionAsync — added in useEffect
- [RESTORED] Map location sync to server + Sync Error alert — added

