/**
 * Zarva Postgres DB Migrator
 * Runs schema.sql against the configured Postgres host.
 */

import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
dotenv.config();

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
const { Pool, Client } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────
// Postgres defaults, overriding any legacy MySQL env vars
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_PORT = (process.env.DB_PORT == '3306' ? 5432 : Number(process.env.DB_PORT)) || 5432;
const DB_USER = (process.env.DB_USER === 'root' ? 'postgres' : process.env.DB_USER) || 'postgres';
const DB_PASSWORD = (process.env.DB_USER === 'root' || !process.env.DB_PASSWORD ? 'Vs@123456' : process.env.DB_PASSWORD);
const DB_NAME = process.env.DB_NAME || 'zarva';

// ── Helpers ───────────────────────────────────────────────────
function log(msg) { console.log(`[migrate] ${msg}`); }
function err(msg) { console.error(`[migrate] ✗ ${msg}`); }
function ok(msg) { console.log(`[migrate] ✓ ${msg}`); }

async function runFile(pool, filePath) {
    const label = filePath.split(/[/\\]/).slice(-2).join('/');
    log(`Running ${label} …`);
    try {
        const sql = await readFile(filePath, 'utf-8');
        await pool.query(sql);
        ok(`${label} done`);
    } catch (e) {
        if (e.code === 'ENOENT') {
            log(`Skipping ${label} (file not found)`);
        } else {
            throw e;
        }
    }
}

// ── Main ──────────────────────────────────────────────────────
async function migrate() {
    log(`Initializing PostgreSQL migration at ${DB_HOST}:${DB_PORT} as ${DB_USER} ...`);

    // 1. Connect to default 'postgres' db to create the target database if it doesn't exist
    const setupClient = new Client({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: 'postgres'
    });

    try {
        await setupClient.connect();
        const res = await setupClient.query(`SELECT 1 FROM pg_database WHERE datname = $1`, [DB_NAME]);
        if (res.rowCount === 0) {
            log(`Creating database '${DB_NAME}' ...`);
            await setupClient.query(`CREATE DATABASE "${DB_NAME}"`);
            ok(`Database created`);
        } else {
            log(`Database '${DB_NAME}' already exists.`);
        }
    } catch (e) {
        err(`Setup phase failed: ${e.message}`);
        process.exit(1);
    } finally {
        await setupClient.end();
    }

    // 2. Connect to the target DB and run schema
    const pool = new Pool({
        host: DB_HOST,
        port: DB_PORT,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME
    });

    try {
        log(`Applying schema to '${DB_NAME}' ...`);
        await runFile(pool, join(__dirname, 'schema.sql'));
        await runFile(pool, join(__dirname, 'seed.sql'));

        ok('Migration complete — zarva DB is ready!');
    } catch (e) {
        err(`Migration failed: ${e.message}`);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

migrate();
