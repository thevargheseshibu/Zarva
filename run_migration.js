import fs from 'fs';
import pg from 'pg';

// Parse .env.development manually
const envConfig = fs.readFileSync('.env.development', 'utf8')
    .split('\n')
    .reduce((acc, line) => {
        const parts = line.split('=');
        if (parts.length >= 2) acc[parts[0].trim()] = parts.slice(1).join('=').trim();
        return acc;
    }, {});

const { Pool } = pg;
const pool = new Pool({
    user: envConfig.DB_USER,
    password: envConfig.DB_PASSWORD,
    host: envConfig.DB_HOST,
    database: envConfig.DB_NAME,
    port: parseInt(envConfig.DB_PORT || '5432')
});

const sql = fs.readFileSync('db/008_custom_jobs.sql').toString();

pool.query(sql)
    .then(() => {
        console.log('Migration complete');
        process.exit(0);
    })
    .catch(e => {
        console.error('Migration failed:', e);
        process.exit(1);
    });
