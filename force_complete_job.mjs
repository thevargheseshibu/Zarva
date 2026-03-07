/**
 * force_complete_job.mjs
 * Directly completes a job bypassing the OTP flow.
 * Run: node force_complete_job.mjs <JOB_ID>
 */

import pg from 'pg';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from 'redis';

const JOB_ID = parseInt(process.argv[2] || '16');

const pool = new pg.Pool({
    host: 'localhost', port: 5432,
    user: 'postgres', password: 'Vs@123456',
    database: 'zarva'
});
const redis = createClient({ url: 'redis://localhost:6379' });
await redis.connect();

const client = await pool.connect();
await client.query('BEGIN');

try {
    // 1. Fetch job
    const { rows: jobs } = await client.query(
        `SELECT * FROM jobs WHERE id = $1 FOR UPDATE`, [JOB_ID]
    );
    const job = jobs[0];
    if (!job) throw new Error(`Job ${JOB_ID} not found`);
    console.log(`\nJob #${JOB_ID} — status: ${job.status}`);

    if (job.status === 'completed') {
        console.log('✅ Already completed. Nothing to do.');
        await client.query('ROLLBACK');
        process.exit(0);
    }

    // 2. Fetch timer events
    const { rows: events } = await client.query(
        `SELECT event_type, server_timestamp FROM job_timer_events WHERE job_id = $1 ORDER BY server_timestamp`, [JOB_ID]
    );

    // 3. Calculate labor time (job_start → job_end only)
    let totalMs = 0, lastStart = null;
    for (const e of events) {
        const ts = new Date(e.server_timestamp).getTime();
        if (e.event_type === 'job_start' || e.event_type === 'job_resume') lastStart = ts;
        else if (e.event_type === 'job_pause' || e.event_type === 'job_end') {
            if (lastStart) { totalMs += ts - lastStart; lastStart = null; }
        }
    }
    // If job started but never ended (still "open"), bill up to now
    if (lastStart) totalMs += Date.now() - lastStart;

    let actualMinutes = Math.floor(totalMs / 60000);
    let billedMinutes = Math.max(actualMinutes, 30); // 30 min minimum

    const hourlyRate = parseFloat(job.hourly_rate || 300); // fallback ₹300
    const laborCost = Math.ceil((billedMinutes / 60) * hourlyRate);
    const inspectionFee = parseFloat(job.inspection_fee || 0);
    const travelCharge = parseFloat(job.travel_charge || 0);
    const materialsCost = parseFloat(job.materials_cost || 0);
    const grandTotal = laborCost + inspectionFee + travelCharge + materialsCost;
    const grandTotalPaise = Math.ceil(grandTotal * 100);

    console.log(`\nBill breakdown:`);
    console.log(`  Labor (${billedMinutes} min @ ₹${hourlyRate}/hr): ₹${laborCost}`);
    console.log(`  Inspection: ₹${inspectionFee}`);
    console.log(`  Travel: ₹${travelCharge}`);
    console.log(`  Materials: ₹${materialsCost}`);
    console.log(`  TOTAL: ₹${grandTotal} (${grandTotalPaise} paise)`);

    // 4. Record job_end event if missing
    const { rows: endCheck } = await client.query(
        `SELECT id FROM job_timer_events WHERE job_id = $1 AND event_type = 'job_end' LIMIT 1`, [JOB_ID]
    );
    if (endCheck.length === 0) {
        await client.query(
            `INSERT INTO job_timer_events (job_id, event_type, triggered_by, notes) VALUES ($1, 'job_end', 'admin', 'Force completed by admin script')`,
            [JOB_ID]
        );
        console.log('\n🕐 Recorded job_end timer event');
    }

    // 5. Update job to completed
    await client.query(
        `UPDATE jobs SET 
            status = 'completed',
            job_ended_at = NOW(),
            final_billed_minutes = $1,
            final_amount = $2,
            end_otp_hash = NULL
         WHERE id = $3`,
        [billedMinutes, grandTotal, JOB_ID]
    );

    // 6. Upsert invoice
    const invNo = `INV-ADMIN-${Date.now()}-${JOB_ID}`;
    await client.query(
        `INSERT INTO job_invoices (job_id, invoice_number, subtotal, platform_fee, travel_charge, discount, tax, total)
         VALUES ($1, $2, $3, 0, $4, 0, 0, $5)
         ON CONFLICT (job_id) DO UPDATE
           SET subtotal = EXCLUDED.subtotal,
               travel_charge = EXCLUDED.travel_charge,
               total = EXCLUDED.total`,
        [JOB_ID, invNo, laborCost + materialsCost, travelCharge, grandTotal]
    );

    // 7. Wallet entries (double-entry ledger)
    const idempotencyBase = `job_complete_${JOB_ID}_admin`;
    const { rows: existingLedger } = await client.query(
        `SELECT id FROM ledger_entries WHERE idempotency_key = $1 LIMIT 1`, [`${idempotencyBase}_1`]
    );

    if (existingLedger.length === 0 && grandTotalPaise > 0) {
        // Fetch ledger account IDs
        const accts = {};
        for (const code of ['ESCROW', 'CUSTOMER_PAYABLE', 'WORKER_EARNINGS', 'PLATFORM_REVENUE', 'PAYMENT_GATEWAY_FEES', 'GST_COLLECTED']) {
            const { rows } = await client.query(`SELECT id FROM ledger_accounts WHERE account_code = $1`, [code]);
            if (rows[0]) accts[code] = rows[0].id;
        }

        // Customer user account
        const { rows: custAcct } = await client.query(
            `INSERT INTO user_accounts (user_id, account_code) VALUES ($1, 'CUSTOMER_PAYABLE') ON CONFLICT DO NOTHING RETURNING id`, [job.customer_id]
        );
        const custAcctId = custAcct[0]?.id || (await client.query(
            `SELECT id FROM user_accounts WHERE user_id = $1 AND account_code = 'CUSTOMER_PAYABLE'`, [job.customer_id]
        )).rows[0].id;

        // Worker user account
        const { rows: wrkAcct } = await client.query(
            `INSERT INTO user_accounts (user_id, account_code) VALUES ($1, 'WORKER_EARNINGS') ON CONFLICT DO NOTHING RETURNING id`, [job.worker_id]
        );
        const wrkAcctId = wrkAcct[0]?.id || (await client.query(
            `SELECT id FROM user_accounts WHERE user_id = $1 AND account_code = 'WORKER_EARNINGS'`, [job.worker_id]
        )).rows[0].id;

        const txnId = uuidv4();
        const workerShare = Math.floor(grandTotalPaise * 0.70);
        const platformShare = Math.floor(grandTotalPaise * 0.25);
        const gatewayFee = Math.floor(grandTotalPaise * 0.02);
        const gst = grandTotalPaise - workerShare - platformShare - gatewayFee;

        const entries = [
            { key: `${idempotencyBase}_1`, acct: accts.CUSTOMER_PAYABLE, userAcct: custAcctId, type: 'credit', amt: grandTotalPaise, desc: 'Release payable' },
            { key: `${idempotencyBase}_2`, acct: accts.ESCROW, userAcct: null, type: 'debit', amt: grandTotalPaise, desc: 'Release escrow' },
            { key: `${idempotencyBase}_3`, acct: accts.WORKER_EARNINGS, userAcct: wrkAcctId, type: 'credit', amt: workerShare, desc: 'Worker 70%' },
            { key: `${idempotencyBase}_4`, acct: accts.PLATFORM_REVENUE, userAcct: null, type: 'credit', amt: platformShare, desc: 'Platform 25%' },
            { key: `${idempotencyBase}_5`, acct: accts.PAYMENT_GATEWAY_FEES, userAcct: null, type: 'credit', amt: gatewayFee, desc: 'Gateway 2%' },
            { key: `${idempotencyBase}_6`, acct: accts.GST_COLLECTED, userAcct: null, type: 'credit', amt: gst, desc: 'GST' },
        ];

        let seq = 1;
        for (const e of entries) {
            if (!e.acct) { console.warn(`⚠️  Skipping entry — ledger account missing for: ${e.desc}`); seq++; continue; }
            await client.query(
                `INSERT INTO ledger_entries (transaction_id, entry_sequence, account_id, user_account_id, entry_type, amount_paise, event_type, job_id, idempotency_key, description, triggered_by_system)
                 VALUES ($1,$2,$3,$4,$5,$6,'job_complete',$7,$8,$9,true)
                 ON CONFLICT (idempotency_key) DO NOTHING`,
                [txnId, seq++, e.acct, e.userAcct, e.type, e.amt, JOB_ID, e.key, `Job ${JOB_ID} – ${e.desc}`]
            );
        }
        console.log('\n💰 Ledger entries posted');
    } else {
        console.log('\n⚠️  Ledger entries already exist or amount is 0, skipping.');
    }

    // 8. Update worker profile
    await client.query(`UPDATE worker_profiles SET total_jobs = total_jobs + 1, current_job_id = NULL WHERE user_id = $1`, [job.worker_id]);
    await client.query(`UPDATE customer_profiles SET total_jobs = total_jobs + 1 WHERE user_id = $1`, [job.customer_id]);

    // 9. Clean up Redis
    await redis.del(`zarva:otp:end:${JOB_ID}`);

    await client.query('COMMIT');
    console.log(`\n✅ Job #${JOB_ID} force-completed successfully!`);
    console.log(`   Invoice: ${invNo}`);
    console.log(`   Total billed: ₹${grandTotal}`);

} catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', err.message);
    console.error(err.stack);
    process.exit(1);
} finally {
    client.release();
    await pool.end();
    await redis.quit();
}
