import express from 'express';
import jobsRouter from './routes/jobs.js';
import { getPool } from './config/database.js';
import { connectRedis } from './config/redis.js';

async function testFetch() {
    await connectRedis();
    const app = express();
    app.use(express.json());
    
    // Auth bypass middleware
    app.use((req, res, next) => {
        req.user = { id: 6 }; // Mock customer ID
        next();
    });

    app.use('/api/jobs', jobsRouter);

    const port = 3001; 
    const server = app.listen(port, async () => {
        try {
            console.log(`Test harness running on ${port}. Fetching job 20...`);
            const fetch = (await import('node-fetch')).default;
            const res = await fetch(`http://localhost:${port}/api/jobs/20`);
            const text = await res.text();
            console.log('Status:', res.status);
            console.log('Body:', text.substring(0, 500));
        } catch (err) {
            console.error('Crash during fetch!', err);
        } finally {
            server.close();
            process.exit(0);
        }
    });
}

testFetch();
