/**
 * Run wallet schema migration against configured PostgreSQL.
 */
import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
dotenv.config();

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const __dirname = dirname(fileURLToPath(import.meta.url));

const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = (process.env.DB_PORT == '3306' ? 5432 : Number(process.env.DB_PORT)) || 5432;
const DB_USER = (process.env.DB_USER === 'root' ? 'postgres' : process.env.DB_USER) || 'postgres';
const DB_PASSWORD = (process.env.DB_USER === 'root' || !process.env.DB_PASSWORD ? 'Vs@123456' : process.env.DB_PASSWORD);
const DB_NAME = process.env.DB_NAME || 'zarva';

async function run() {
    const pool = new pg.Pool({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME
    });

    try {
        const sql = await readFile(join(__dirname, 'wallet_schema.sql'), 'utf-8');
        await pool.query(sql);
        console.log('[wallet migration] ✓ Done');
    } catch (e) {
        console.error('[wallet migration] ✗', e.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
