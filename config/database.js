/**
 * PostgreSQL connection pool wrapper mimicking mysql2 returning structure [rows, fields].
 */
import pg from 'pg';
const { Pool } = pg;

let pgPool = null;

function getPool() {
    if (pgPool) return wrappedPool;

    const host = process.env.DB_HOST || 'localhost';
    const port = (process.env.DB_PORT == '3306' ? 5432 : Number(process.env.DB_PORT)) || 5432;
    const user = (process.env.DB_USER === 'root' ? 'postgres' : process.env.DB_USER) || 'postgres';
    const password = (process.env.DB_USER === 'root' || !process.env.DB_PASSWORD ? 'Vs@123456' : process.env.DB_PASSWORD);
    const database = process.env.DB_NAME || 'zarva';

    console.log(`[DB] Initializing pool: ${user}@${host}:${port}/${database}`);

    pgPool = new Pool({
        host,
        port,
        user,
        password,
        database,
        max: Number(process.env.DB_POOL_MAX) || 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 5000, // Slightly longer for stability
    });

    return wrappedPool;
}

const wrappedPool = {
    query: async (text, params) => {
        const res = await pgPool.query(text, params);
        // Map PostgreSQL's RETURNING output format to MySQL's insertId if applicable
        if (text.trim().toUpperCase().startsWith('INSERT') && res.rows.length > 0 && res.rows[0].id) {
            res.insertId = res.rows[0].id;
        }
        return [res.rows, res.fields, res];
    },
    execute: async (text, params) => {
        const res = await pgPool.query(text, params);
        if (text.trim().toUpperCase().startsWith('INSERT') && res.rows.length > 0 && res.rows[0].id) {
            res.insertId = res.rows[0].id;
        }
        return [res.rows, res.fields, res];
    },
    getConnection: async () => {
        const client = await pgPool.connect();
        return {
            query: async (text, params) => {
                const res = await client.query(text, params);
                if (text.trim().toUpperCase().startsWith('INSERT') && res.rows.length > 0 && res.rows[0].id) {
                    res.insertId = res.rows[0].id;
                }
                return [res.rows, res.fields, res];
            },
            execute: async (text, params) => {
                const res = await client.query(text, params);
                if (text.trim().toUpperCase().startsWith('INSERT') && res.rows.length > 0 && res.rows[0].id) {
                    res.insertId = res.rows[0].id;
                }
                return [res.rows, res.fields, res];
            },
            release: () => client.release(),
            ping: async () => client.query('SELECT 1'),
            beginTransaction: async () => client.query('BEGIN'),
            commit: async () => client.query('COMMIT'),
            rollback: async () => client.query('ROLLBACK'),
        };
    },
    end: () => pgPool.end()
};

async function testConnection() {
    try {
        const conn = await wrappedPool.getConnection();
        await conn.ping();
        conn.release();
        console.log('[DB] PostgreSQL connection OK');
        return true;
    } catch (err) {
        console.error('[DB] PostgreSQL connection failed:', err.message);
        return false;
    }
}

export { getPool, testConnection };
