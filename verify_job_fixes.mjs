import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.development' });

const API_URL = 'http://localhost:3000';
const TEST_TOKEN = 'your_test_token_here'; // I need a real token to test protected routes

async function testEstimate() {
    try {
        console.log('Testing /api/jobs/estimate...');
        const res = await axios.post(`${API_URL}/api/jobs/estimate`, {
            category: 'Electrician',
            hours: 2
        }, {
            headers: {
                'Authorization': `Bearer ${TEST_TOKEN}`
            }
        });
        console.log('Estimate response:', JSON.stringify(res.data, null, 2));
    } catch (err) {
        console.error('Estimate test failed:', err.response?.data || err.message);
    }
}

// I'll skip execution if I don't have a token, but I can check if the route exists at least (getting 401 instead of 404)
async function checkRouteExists() {
    try {
        console.log('Checking if /api/jobs/estimate exists...');
        await axios.post(`${API_URL}/api/jobs/estimate`);
    } catch (err) {
        if (err.response?.status === 401) {
            console.log('Success: Route exists (returned 401 Unauthorized)');
        } else {
            console.log('Route might be missing or other error:', err.response?.status);
        }
    }
}

checkRouteExists();
