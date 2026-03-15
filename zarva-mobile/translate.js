const fs = require('fs');
const path = require('path');
const enText = fs.readFileSync(path.join('src', 'i18n', 'translations', 'en.js'), 'utf-8');


// Parse the export default object natively to support multi-line and robust keys
const code = enText.replace('export default', 'module.exports =');
const m = { exports: {} };
new Function('module', 'exports', code)(m, m.exports);
const enObj = m.exports;

const keys = Object.keys(enObj);
const values = Object.values(enObj);

const langs = ['hi', 'ta', 'te', 'bn', 'kn', 'mr', 'gu', 'pa', 'or', 'as'];
const delay = ms => new Promise(r => setTimeout(r, ms));

async function translate(text, targetLang) {
    if (!text || typeof text !== 'string') return text;

    // Tokenize parameters like {{var}} to protect them from translation
    let tempText = text;
    const vars = [];
    let vIndex = 0;
    tempText = tempText.replace(/{{([^}]+)}}/g, (match) => {
        vars.push(match);
        return `__VAR_${vIndex++}__`;
    });

    try {
        const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=' + targetLang + '&dt=t&q=' + encodeURIComponent(tempText);
        const res = await fetch(url);
        const json = await res.json();
        
        let translated = json[0].map(x => x[0]).join('');

        // Restore parameters
        vars.forEach((v, index) => {
            translated = translated.replace(new RegExp(`__VAR_${index}__`, 'g'), v);
            // sometimes translate API adds spaces around underscores
            translated = translated.replace(new RegExp(`__ VAR _ ${index} __`, 'g'), v);
        });

        return translated;
    } catch (e) {
        console.warn('Translate API error:', e.message);
        return text; // fallback to english on error
    }
}

async function run() {
    for (const lang of langs) {
        console.log('Translating to ' + lang + '...');
        let out = 'export default {\n';
        for (let i = 0; i < keys.length; i++) {
            const translated = await translate(values[i], lang);
            const key = keys[i];
            
            // Format output safely
            if (translated.includes('\n')) {
                out += `    ${key}: \`${translated.replace(/`/g, '\\`')}\`,\n`;
            } else if (translated.includes("'")) {
                out += `    ${key}: "${translated.replace(/"/g, '\\"')}",\n`;
            } else {
                out += `    ${key}: '${translated}',\n`;
            }

            // Rate limit to avoid IP ban
            await delay(300);
        }
        out += '};\n';
        fs.writeFileSync(path.join('src', 'i18n', 'translations', lang + '.js'), out);
        console.log('Done ' + lang);
        await delay(2000); // Wait between languages
    }
}

run();
