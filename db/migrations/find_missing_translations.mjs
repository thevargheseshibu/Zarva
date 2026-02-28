/**
 * Find all t('key') usages in customer screens and compare against en.js
 * Outputs keys that are used but NOT defined in en.js
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readdirSync, statSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');
const mobileRoot = join(root, 'zarva-mobile/src');
const enPath = join(mobileRoot, 'i18n/translations/en.js');

// Read en.js and extract all keys
const enContent = readFileSync(enPath, 'utf8');
const enKeys = new Set();
const keyRegex = /^\s+(\w+):\s+['`]/gm;
let m;
while ((m = keyRegex.exec(enContent)) !== null) {
    enKeys.add(m[1]);
}
console.log(`\n✅ en.js has ${enKeys.size} keys\n`);

// Find all JSX/JS files in customer screens
function getAllFiles(dir) {
    const entries = readdirSync(dir, { withFileTypes: true });
    return entries.flatMap(e => {
        const full = join(dir, e.name);
        return e.isDirectory() ? getAllFiles(full) : [full];
    });
}

const screenDirs = [
    join(mobileRoot, 'screens/customer'),
    join(mobileRoot, 'screens/shared'),
];

const usedKeys = new Set();
const keyUsageRegex = /t\(['"]([^'"]+)['"]/g;

for (const dir of screenDirs) {
    for (const file of getAllFiles(dir)) {
        if (!file.endsWith('.jsx') && !file.endsWith('.js')) continue;
        const content = readFileSync(file, 'utf8');
        let match;
        while ((match = keyUsageRegex.exec(content)) !== null) {
            usedKeys.add(match[1]);
        }
        keyUsageRegex.lastIndex = 0;
    }
}

// Find missing keys
const missing = [...usedKeys].filter(k => !enKeys.has(k)).sort();
console.log(`📊 Used keys: ${usedKeys.size}, Missing from en.js: ${missing.length}\n`);
if (missing.length) {
    console.log('=== MISSING KEYS ===');
    missing.forEach(k => console.log(`  ${k}`));
}
