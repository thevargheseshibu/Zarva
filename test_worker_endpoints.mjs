import { getPool } from './config/database.js';
import { connectRedis } from './config/redis.js';
import workerRouter from './routes/worker.js';

async function test() {
    await connectRedis();
    const pool = getPool();
    
    // Manual mock of req, res setup
    const req = {
        method: 'GET',
        url: '/history',
        user: { id: 5 },
        path: '/history',
        query: {}
    };
    
    const res = {
        status: function(code) {
            this.statusCode = code;
            return this;
        },
        json: function(data) {
            console.log('Response:', data);
            return this;
        }
    };
    
    console.log('Testing /history');
    await new Promise((resolve, reject) => {
        workerRouter(req, res, (err) => {
            if (err) reject(err);
            resolve();
        });
    });
    
    console.log('Done test');
    process.exit(0);
}

test().catch(err => {
    console.error('Crash error:', err);
    process.exit(1);
});
