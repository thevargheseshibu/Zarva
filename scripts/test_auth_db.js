
import { getPool } from '../config/database.js';
import { findOrCreateUser, issueTokenPair } from '../services/auth.service.js';

async function testAuthSequence() {
    const pool = getPool();
    try {
        console.log('Testing findOrCreateUser...');
        const user = await findOrCreateUser('+919746020743', pool);
        console.log('User found/created:', user);

        console.log('Testing issueTokenPair...');
        const meta = { device_info: 'test', ip_address: '127.0.0.1' };
        const tokens = await issueTokenPair(user, pool, meta);
        console.log('Tokens issued successfully.');
    } catch (err) {
        console.error('Test failed with error:', err);
    } finally {
        await pool.end();
    }
}

testAuthSequence();
