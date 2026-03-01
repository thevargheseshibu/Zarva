
import { createClient } from 'redis';

const client = createClient({
    url: 'redis://localhost:6379'
});

async function checkRedis() {
    try {
        await client.connect();
        const otp = await client.get('zarva:otp:end:10');
        console.log('Redis OTP for job 10:', otp);
    } catch (err) {
        console.error(err);
    } finally {
        await client.disconnect();
    }
}

checkRedis();
