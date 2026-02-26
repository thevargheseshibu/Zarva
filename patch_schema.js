import fs from 'fs';
import path from 'path';

const schemaPath = path.join(process.cwd(), 'db', 'schema.sql');
let content = fs.readFileSync(schemaPath, 'utf8');

content = content.replace(/CREATE TYPE (\w+) AS ENUM/g, (match, typeName) => {
    return `DROP TYPE IF EXISTS ${typeName} CASCADE;\nCREATE TYPE ${typeName} AS ENUM`;
});

fs.writeFileSync(schemaPath, content, 'utf8');
console.log('Patched schema.sql to be idempotent for types.');
