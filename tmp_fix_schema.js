import { getPool } from './config/database.js';
const pool = getPool();
try {
    console.log('Altering followup_job_id column and adding foreign key...');
    await pool.query(`
        ALTER TABLE jobs 
        ALTER COLUMN followup_job_id TYPE bigint 
        USING NULL; -- Since the column is empty, we can just use NULL to satisfy conversion
        
        ALTER TABLE jobs 
        ADD CONSTRAINT fk_followup_job 
        FOREIGN KEY (followup_job_id) 
        REFERENCES jobs(id)
    `);
    console.log('Success!');
} catch (err) {
    console.error('Failed to alter table:', err);
} finally {
    process.exit(0);
}
