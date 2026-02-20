import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { colors, spacing, radius } from '../../design-system/tokens';
import GoldButton from '../../components/GoldButton';

const LANGUAGES = [
    { code: 'ml', label: 'മലയാളം', sub: 'Malayalam' },
    { code: 'en', label: 'English', sub: 'English' },
];

export default function LanguageScreen({ navigation }) {
    const [selected, setSelected] = React.useState('ml');
    return (
        <View style={styles.screen}>
            <Text style={styles.title}>Choose Language</Text>
            <Text style={styles.sub}>ഭാഷ തിരഞ്ഞെടുക്കുക</Text>
            {LANGUAGES.map((l) => (
                <TouchableOpacity
                    key={l.code}
                    style={[styles.option, selected === l.code && styles.selected]}
                    onPress={() => setSelected(l.code)}
                >
                    <Text style={styles.langPrimary}>{l.label}</Text>
                    <Text style={styles.langSub}>{l.sub}</Text>
                </TouchableOpacity>
            ))}
            <GoldButton title="Continue" onPress={() => navigation.navigate('Phone')} style={{ marginTop: spacing.xl }} />
        </View>
    );
}

const styles = StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.bg.primary, padding: spacing.xl, justifyContent: 'center', gap: spacing.md },
    title: { color: colors.text.primary, fontSize: 28, fontWeight: '700', textAlign: 'center' },
    sub: { color: colors.text.secondary, fontSize: 14, textAlign: 'center', marginBottom: spacing.md },
    option: { backgroundColor: colors.bg.elevated, borderRadius: radius.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.bg.surface },
    selected: { borderColor: colors.gold.primary, backgroundColor: colors.gold.glow },
    langPrimary: { color: colors.text.primary, fontSize: 18, fontWeight: '600' },
    langSub: { color: colors.text.secondary, fontSize: 12, marginTop: 2 },
});
