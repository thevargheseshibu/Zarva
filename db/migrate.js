/**
 * Zarva DB Migrator
 * Runs schema.sql then seed.sql against the configured MySQL host.
 *
 * Usage:
 *   node db/migrate.js              (uses .env.development)
 *   NODE_ENV=production node db/migrate.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: `.env.${process.env.NODE_ENV || 'development'}` });
dotenv.config();   // fallback to .env

import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────
const DB_CONFIG = {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    // NOTE: No `database` here — schema.sql runs CREATE DATABASE zarva itself
    multipleStatements: true,
};

// ── Helpers ───────────────────────────────────────────────────
function log(msg) { console.log(`[migrate] ${msg}`); }
function err(msg) { console.error(`[migrate] ✗ ${msg}`); }
function ok(msg) { console.log(`[migrate] ✓ ${msg}`); }

async function runFile(conn, filePath) {
    const label = filePath.split(/[/\\]/).slice(-2).join('/');
    log(`Running ${label} …`);
    const sql = await readFile(filePath, 'utf-8');
    await conn.query(sql);
    ok(`${label} done`);
}

// ── Main ──────────────────────────────────────────────────────
async function migrate() {
    let conn;
    try {
        log(`Connecting to MySQL at ${DB_CONFIG.host}:${DB_CONFIG.port} as ${DB_CONFIG.user} …`);
        conn = await mysql.createConnection(DB_CONFIG);
        ok('Connected');

        await runFile(conn, join(__dirname, 'schema.sql'));
        await runFile(conn, join(__dirname, 'seed.sql'));

        ok('Migration complete — zarva DB is ready!');
    } catch (e) {
        err(e.message);
        process.exit(1);
    } finally {
        if (conn) await conn.end();
    }
}

migrate();
