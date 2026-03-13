import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new pg.Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'Vs@123456',
  database: process.env.DB_NAME || 'zarva'
});

async function checkWorkerStatus() {
  try {
    // Check all workers and their KYC status
    const result = await pool.query(`
      SELECT 
        u.id,
        u.phone,
        u.role,
        u.active_role,
        wp.kyc_status,
        wp.is_verified,
        wp.name,
        wp.category,
        wp.created_at,
        wp.updated_at
      FROM users u
      LEFT JOIN worker_profiles wp ON wp.user_id = u.id
      WHERE u.role = 'worker' OR u.active_role = 'worker'
      ORDER BY u.id DESC
      LIMIT 10
    `);
    
    console.log('Worker KYC Status Report:');
    console.log('========================');
    
    result.rows.forEach((row, index) => {
      console.log(`\nWorker ${index + 1}:`);
      console.log(`  User ID: ${row.id}`);
      console.log(`  Phone: ${row.phone}`);
      console.log(`  Role: ${row.role}`);
      console.log(`  Active Role: ${row.active_role}`);
      console.log(`  KYC Status: ${row.kyc_status}`);
      console.log(`  Is Verified: ${row.is_verified}`);
      console.log(`  Name: ${row.name || 'N/A'}`);
      console.log(`  Category: ${row.category || 'N/A'}`);
      console.log(`  Created: ${row.created_at}`);
      console.log(`  Updated: ${row.updated_at}`);
      
      // Check if this worker should be approved
      const shouldBeApproved = row.kyc_status === 'approved' && row.is_verified === true;
      console.log(`  Should have access: ${shouldBeApproved}`);
      
      if (row.kyc_status === 'approved' && !row.is_verified) {
        console.log(`  ⚠️  ISSUE: KYC is approved but is_verified is false!`);
      }
    });
    
    // Summary statistics
    const summary = await pool.query(`
      SELECT 
        kyc_status,
        COUNT(*) as count,
        COUNT(CASE WHEN is_verified = true THEN 1 END) as verified_count
      FROM worker_profiles
      GROUP BY kyc_status
      ORDER BY kyc_status
    `);
    
    console.log('\n\nKYC Status Summary:');
    console.log('===================');
    summary.rows.forEach(row => {
      console.log(`${row.kyc_status}: ${row.count} workers (${row.verified_count} verified)`);
    });
    
    await pool.end();
  } catch (err) {
    console.error('Database error:', err.message);
    process.exit(1);
  }
}

checkWorkerStatus();