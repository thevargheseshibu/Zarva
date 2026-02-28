const fs = require('fs');

const screenJs = 'zarva-mobile/src/screens/worker/ActiveJobScreen.jsx';
let sContent = fs.readFileSync(screenJs, 'utf8');

// Add states
if (!sContent.includes("const [inspectionOtp")) {
    sContent = sContent.replace(
        "const [startOtp, setStartOtp] = useState(['', '', '', '']);",
        "const [startOtp, setStartOtp] = useState(['', '', '', '']);\n    const [inspectionOtp, setInspectionOtp] = useState(['', '', '', '']);\n    const [estimatedMinutes, setEstimatedMinutes] = useState('60');\n    const [estimateNotes, setEstimateNotes] = useState('');"
    );
}

// Add Handler functions
if (!sContent.includes("handleVerifyInspectionOtp")) {
    const newHandlers = \
    const handleVerifyInspectionOtp = async () => {
        const code = inspectionOtp.join('');
        if (code.length !== 4) return;
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        try {
            await apiClient.post(\\\/api/worker/jobs/\\\/verify-inspection-otp\\\, { code });
            setStatus('inspection_active');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Invalid Code', err.response?.data?.message || 'Incorrect service code.');
            setInspectionOtp(['', '', '', '']);
        } finally {
            setActionLoading(false);
        }
    };

    const handleSubmitEstimate = async () => {
        setActionLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await apiClient.post(\\\/api/worker/jobs/\\\/inspection/estimate\\\, {
                estimated_minutes: parseInt(estimatedMinutes) || 60,
                notes: estimateNotes
            });
            setStatus('estimate_submitted');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert('Error', err.response?.data?.message || 'Failed to submit estimate.');
        } finally {
            setActionLoading(false);
        }
    };
    \;
    sContent = sContent.replace("const handleVerifyStartOtp", newHandlers + "\\n    const handleVerifyStartOtp");
}

// Ensure TextInput is imported
if (!sContent.includes("TextInput")) {
    sContent = sContent.replace("import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking } from 'react-native';", "import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, ActivityIndicator, Linking, TextInput } from 'react-native';");
}

fs.writeFileSync(screenJs, sContent, 'utf8');
console.log('States added');
