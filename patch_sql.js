import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function walk(dir, fileList = []) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const filePath = path.join(dir, file);
        if (fs.statSync(filePath).isDirectory()) {
            walk(filePath, fileList);
        } else if (file.endsWith('.js')) {
            fileList.push(filePath);
        }
    }
    return fileList;
}

const routesDir = path.join(__dirname, 'routes');
if (!fs.existsSync(routesDir)) {
    console.error(`Routes dir not found`);
    process.exit(1);
}

const files = walk(routesDir);
let totalPatched = 0;

for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    let patched = false;

    // Pattern to grab from query( or execute( up to the start of the param array [, ignoring empty space and newlines
    // \`[^\`]*\` matches backtick strings
    // '[^']*' matches single quote strings
    // "[^"]*" matches double quote strings
    const regex = /(query|execute)\s*\(\s*(\`[^\`]*\`|'[^']*'|"[^"]*")\s*,\s*\[/g;

    const newContent = content.replace(regex, (match, method, sqlArgs) => {
        let index = 1;

        // Strip the boundary quotes to inspect contents
        const quoteType = sqlArgs[0];
        const innerText = sqlArgs.slice(1, -1);

        let result = '';
        let inExpr = 0;

        for (let i = 0; i < innerText.length; i++) {
            const char = innerText[i];
            const nextChar = innerText[i + 1] || '';

            if (quoteType === '`' && char === '$' && nextChar === '{') {
                inExpr++;
                result += char;
            } else if (quoteType === '`' && char === '}' && inExpr > 0) {
                inExpr--;
                result += char;
            } else if (char === '?' && inExpr === 0) {
                result += '$' + (index++);
            } else {
                result += char;
            }
        }

        const newSqlString = quoteType + result + quoteType;

        if (newSqlString !== sqlArgs) {
            patched = true;
            return `${method}(${newSqlString}, [`;
        }
        return match;
    });

    if (patched) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log(`Patched ${file}`);
        totalPatched++;
    }
}

console.log(`Total files patched: ${totalPatched}`);
