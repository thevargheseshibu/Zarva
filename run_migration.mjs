import pg from 'pg';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Vs@123456',
  database: process.env.DB_NAME || 'zarva'
});

try {
  const sql = await readFile('./db/migrations/20260307_add_customer_location_columns.sql', 'utf-8');
  await pool.query(sql);
  console.log('✓ Migration applied successfully');
  await pool.end();
} catch (err) {
  console.error('✗ Migration failed:', err.message);
  process.exit(1);
}