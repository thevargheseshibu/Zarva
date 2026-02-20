/**
 * MySQL connection pool.
 * Uses mysql2/promise with environment-driven config.
 */

import mysql from 'mysql2/promise';

let pool = null;

/**
 * Initialise (or return cached) MySQL pool.
 * @returns {import('mysql2/promise').Pool}
 */
function getPool() {
    if (pool) return pool;

    pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        port: Number(process.env.DB_PORT) || 3306,
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'zarva_dev',
        waitForConnections: true,
        connectionLimit: Number(process.env.DB_POOL_MAX) || 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 10000,
        timezone: '+05:30', // Asia/Kolkata
    });

    return pool;
}

/**
 * Test DB connectivity — returns true on success.
 * @returns {Promise<boolean>}
 */
async function testConnection() {
    try {
        const conn = await getPool().getConnection();
        await conn.ping();
        conn.release();
        console.log('[DB] MySQL connection OK');
        return true;
    } catch (err) {
        console.error('[DB] MySQL connection failed:', err.message);
        return false;
    }
}

export { getPool, testConnection };
