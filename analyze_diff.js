const fs = require('fs');
const diff = fs.readFileSync('diff.txt', 'utf8');

const files = diff.split('diff --git');
let report = '';
for (const file of files) {
    if (!file.trim() || !file.includes('zarva-mobile/src/screens')) continue;

    const match = file.match(/b\/(.*?)\n/);
    const filename = match ? match[1] : 'unknown';

    const lines = file.split('\n');
    const deletedLines = lines.filter(l => l.startsWith('-') && !l.startsWith('---'));
    const addedLines = lines.filter(l => l.startsWith('+') && !l.startsWith('+++'));

    // Clean up to compare logic
    const deletedCode = deletedLines.map(l => l.substring(1).trim()).filter(l => l);
    const addedCode = new Set(addedLines.map(l => l.substring(1).trim()).filter(l => l));

    const suspiciousDeletions = deletedCode.filter(line => {
        if (addedCode.has(line)) return false; // same line was added back

        // Check for important dropped keywords
        const isImportant =
            line.includes('=> {') ||
            line.includes('function ') ||
            line.includes('apiClient.') ||
            line.includes('navigation.navigate') ||
            line.includes('Alert.alert') ||
            line.includes('<TouchableOpacity') ||
            line.includes('onPress=') ||
            line.includes('useEffect(');

        // Ignore simple refactoring renames or styling changes
        if (line.includes('styles.') || line.includes('colors.') || line.includes('t.')) {
            // We might want to keep it if it's an onPress that has styles
            if (!line.includes('onPress=')) return false;
        }

        return isImportant;
    });

    if (suspiciousDeletions.length > 0) {
        report += `\n--- ${filename} ---\n`;
        suspiciousDeletions.forEach(l => report += `- ${l}\n`);
    }
}

fs.writeFileSync('dropped_logic.txt', report);
console.log('Analysis complete. Check dropped_logic.txt');
