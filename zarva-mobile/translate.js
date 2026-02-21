const fs = require('fs');
const path = require('path');
const enText = fs.readFileSync(path.join('src', 'i18n', 'translations', 'en.js'), 'utf-8');

// Regex to extract keys and values from en.js
const regex = /^\s*([a-zA-Z0-9_]+):\s*'([^']*)',/gm;
let match;
const keys = [];
const values = [];

while ((match = regex.exec(enText)) !== null) {
    keys.push(match[1]);
    values.push(match[2]);
}

const langs = ['hi', 'ta', 'te', 'bn', 'kn', 'mr', 'gu', 'pa', 'or', 'as'];

async function translate(text, targetLang) {
    if (text.includes('{{')) return text; // skip parameterized lines for safety in simple script
    try {
        const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' + targetLang + '&dt=t&q=' + encodeURIComponent(text);
        const res = await fetch(url);
        const json = await res.json();
        return json[0].map(x => x[0]).join('');
    } catch (e) {
        return text;
    }
}

async function run() {
    for (const lang of langs) {
        console.log('Translating to ' + lang + '...');
        let out = 'export default {\n';
        for (let i = 0; i < keys.length; i++) {
            const translated = await translate(values[i], lang);
            out += '    ' + keys[i] + ': \'' + translated.replace(/'/g, "\\'") + '\',\n';
        }
        out += '};\n';
        fs.writeFileSync(path.join('src', 'i18n', 'translations', lang + '.js'), out);
        console.log('Done ' + lang);
    }
}

run();
