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

async function checkJob15() {
  try {
    // Check Job 15 details
    const jobResult = await pool.query(`
      SELECT 
        id,
        customer_id,
        worker_id,
        status,
        start_otp_hash,
        end_otp_hash,
        work_started_at,
        work_ended_at,
        created_at,
        updated_at
      FROM jobs 
      WHERE id = 15
    `);
    
    console.log('Job 15 Details:');
    console.log('================');
    
    if (jobResult.rows.length === 0) {
      console.log('❌ Job 15 not found in database');
      return;
    }
    
    const job = jobResult.rows[0];
    console.log(`Job ID: ${job.id}`);
    console.log(`Customer ID: ${job.customer_id}`);
    console.log(`Worker ID: ${job.worker_id}`);
    console.log(`Status: ${job.status}`);
    console.log(`Start OTP Hash: ${job.start_otp_hash}`);
    console.log(`End OTP Hash: ${job.end_otp_hash}`);
    console.log(`Work Started: ${job.work_started_at}`);
    console.log(`Work Ended: ${job.work_ended_at}`);
    console.log(`Created: ${job.created_at}`);
    console.log(`Updated: ${job.updated_at}`);
    
    // Check related users
    console.log('\n\nRelated Users:');
    console.log('===============');
    
    // Customer details
    if (job.customer_id) {
      const customerResult = await pool.query(`
        SELECT id, phone, name, role, active_role
        FROM users 
        WHERE id = $1
      `, [job.customer_id]);
      
      if (customerResult.rows.length > 0) {
        const customer = customerResult.rows[0];
        console.log(`Customer: ${customer.name} (${customer.phone}) - ID: ${customer.id}`);
      }
    }
    
    // Worker details
    if (job.worker_id) {
      const workerResult = await pool.query(`
        SELECT id, phone, name, role, active_role
        FROM users 
        WHERE id = $1
      `, [job.worker_id]);
      
      if (workerResult.rows.length > 0) {
        const worker = workerResult.rows[0];
        console.log(`Worker: ${worker.name} (${worker.phone}) - ID: ${worker.id}`);
      }
    }
    
    // Check if completion code should be available
    console.log('\n\nCompletion Code Analysis:');
    console.log('=========================');
    
    if (job.status === 'completed' && !job.end_otp_hash) {
      console.log('❌ ISSUE: Job is completed but no end OTP hash generated!');
    } else if (job.status === 'completed' && job.end_otp_hash) {
      console.log('✅ Job completed with end OTP hash');
    } else if (job.status !== 'completed' && !job.end_otp_hash) {
      console.log('ℹ️  Job not completed yet - end OTP will be generated when job completes');
    } else if (job.status !== 'completed' && job.end_otp_hash) {
      console.log('⚠️  Job not completed but has end OTP hash (unusual)');
    }
    
    // Check job invoices for completion code
    const invoiceResult = await pool.query(`
      SELECT id, completion_code, created_at
      FROM job_invoices 
      WHERE job_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `, [15]);
    
    if (invoiceResult.rows.length > 0) {
      console.log('\n\nJob Invoice:');
      console.log('=============');
      const invoice = invoiceResult.rows[0];
      console.log(`Invoice ID: ${invoice.id}`);
      console.log(`Completion Code: ${invoice.completion_code}`);
      console.log(`Created: ${invoice.created_at}`);
    } else {
      console.log('\n\n❌ No job invoices found for Job 15');
    }
    
    await pool.end();
  } catch (err) {
    console.error('Database error:', err.message);
    process.exit(1);
  }
}

checkJob15();