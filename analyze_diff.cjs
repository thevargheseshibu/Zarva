const { execSync } = require('child_process');
const fs = require('fs');

try {
    const diff = execSync('git diff HEAD~1 HEAD zarva-mobile/src/screens zarva-mobile/src/components', { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });

    const files = diff.split('diff --git ');
    let report = '';
    for (const file of files) {
        if (!file.trim() || (!file.includes('zarva-mobile/src/screens') && !file.includes('zarva-mobile/src/components'))) continue;

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

            const isImportant =
                line.includes('=> {') ||
                line.includes('function ') ||
                line.includes('apiClient.') ||
                line.includes('navigation.navigate') ||
                line.includes('Alert.alert') ||
                line.includes('<TouchableOpacity') ||
                line.includes('onPress=') ||
                line.includes('useEffect(') ||
                line.includes('.map(') ||
                line.includes('set') || // states
                line.includes('const [') ||
                line.includes('<Text') ||
                line.includes('<View');

            if (!isImportant) return false;

            // Ignore standard theme replacements 
            if (line.includes('styles.') || line.includes('t.') || line.includes('colors.')) {
                // Unless it has something important
                if (!line.includes('onPress=') && !line.includes('apiClient')) return false;
            }

            // Ignore basic single line View/Text wrappers without logic
            if (line === '<View>' || line === '</View>' || line === '<Text>' || line === '</Text>') return false;

            return true;
        });

        if (suspiciousDeletions.length > 0) {
            report += `\n--- ${filename} ---\n`;
            suspiciousDeletions.forEach(l => report += `- ${l}\n`);
        }
    }

    fs.writeFileSync('dropped_logic.txt', report);
    console.log('Analysis complete. Check dropped_logic.txt');
} catch (e) {
    console.error(e);
}
