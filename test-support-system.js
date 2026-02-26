// test-support-system.js
import { getPool } from './config/database.js';
import supportService from './services/supportService.js';
import * as firebaseService from './services/firebase.service.js';
import configLoader from './config/loader.js';

// Mock live tracking constraint for test env
// Firebase won't initialize without credentials so the service handles it internally

async function runTests() {
    await configLoader.loadAllConfigs();
    const pool = getPool();
    console.log('--- STARTING UNIFIED SUPPORT SYSTEM TESTS ---');

    try {
        // 1. Setup mock users & job
        const mockUserId = 999111;
        const mockAdminId = 888111;
        const mockJobId = 777111;

        await pool.query(`INSERT INTO users (id, phone, role) VALUES ($1, '9999999999', 'customer') ON CONFLICT DO NOTHING`, [mockUserId]);
        await pool.query(`INSERT INTO users (id, phone, role) VALUES ($1, '8888888888', 'admin') ON CONFLICT DO NOTHING`, [mockAdminId]);
        await pool.query(`INSERT INTO user_job_slots (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [mockUserId]);

        // Insert a mock job bridging the customer
        await pool.query(`
            INSERT INTO jobs (id, customer_id, worker_id, category, status, address, job_location, idempotency_key, pincode, rate_per_hour) 
            VALUES ($1, $2, NULL, 'cleaning', 'assigned', 'Test Address', ST_SetSRID(ST_MakePoint(0,0), 4326), 'test-idemp-123', '682001', 150.00)
            ON CONFLICT DO NOTHING
        `, [mockJobId, mockUserId]);

        console.log('✅ Setup mock data');

        // 2. Test Concurrency Rules (Initially OK)
        let slotCheck = await supportService.canUserTakeNewJob(mockUserId);
        console.log('Initial Slot Check:', slotCheck);

        // 3. Create General Ticket (Should NOT affect concurrency)
        const generalTicket = await supportService.createTicket({
            user_id: mockUserId,
            user_role: 'customer',
            ticket_type: 'general_chat',
            description: 'I need general help with my profile'
        });
        console.log('✅ Created General Ticket:', generalTicket.ticket_number);

        slotCheck = await supportService.canUserTakeNewJob(mockUserId);
        if (slotCheck.can_take !== true) throw new Error("General ticket broke concurrency locks!");

        // 4. Create Formal Job Dispute
        const disputeTicket = await supportService.createTicket({
            user_id: mockUserId,
            user_role: 'customer',
            ticket_type: 'job_dispute',
            job_id: mockJobId,
            category: 'worker_behavior',
            description: 'The worker did not show up on time.'
        });
        console.log('✅ Created Formal Dispute:', disputeTicket.ticket_number);

        // 5. Test Concurrency Rules (Should be 1 dispute now)
        slotCheck = await supportService.canUserTakeNewJob(mockUserId);
        console.log('Mid-Dispute Slot Check:', slotCheck);

        // 6. Test Messaging
        const msg = await supportService.addMessage(disputeTicket.ticket_id, mockAdminId, 'admin', 'We are looking into this.');
        console.log('✅ Admin Msg Added:', msg.message_text);

        // 7. Test Admin Resolution
        await supportService.resolveTicket(disputeTicket.ticket_id, mockAdminId, {
            type: 'warning_issued',
            notes: 'Warned the worker'
        });
        console.log('✅ Admin Resolved Dispute');

        // 8. Test Concurrency Rules (Should be unlocked again)
        slotCheck = await supportService.canUserTakeNewJob(mockUserId);
        console.log('Post-Resolution Slot Check:', slotCheck);

    } catch (err) {
        console.error('❌ Test Failed:', err);
    } finally {
        console.log('--- CLEANUP ---');
        // Delete the mock data in correct FK order
        await pool.query(`DELETE FROM support_tickets WHERE raised_by_user_id IN (999111, 888111)`);
        await pool.query(`DELETE FROM user_job_slots WHERE user_id = 999111`);
        await pool.query(`DELETE FROM jobs WHERE id = 777111`);
        await pool.query(`DELETE FROM users WHERE id IN (999111, 888111)`);
        process.exit(0);
    }
}

// Run immediately since this is an isolated script
import('./config/database.js').then(({ testConnection }) => {
    testConnection().then(() => runTests());
});
