
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.development from parent dir
dotenv.config({ path: path.join(__dirname, '..', '.env.development') });

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
// We need a valid token to test protected routes.
// However, since I can't easily get one, I'll check if the route exists by looking for 401/403 instead of 404.
// If it exists, it should return 401 if no token, or 403 if token is invalid.
// A 404 means the route is still missing.

async function testStats() {
    console.log(`Testing ${API_URL}/api/worker/stats ...`);
    try {
        const res = await axios.get(`${API_URL}/api/worker/stats`);
        console.log('Result:', res.status, res.data);
    } catch (err) {
        if (err.response) {
            console.log('Status:', err.response.status);
            console.log('Data:', err.response.data);
            if (err.response.status === 401 || err.response.status === 403) {
                console.log('SUCCESS: Route exists (access denied as expected).');
            } else if (err.response.status === 404) {
                console.log('FAILURE: Route still returns 404.');
            }
        } else {
            console.log('Error:', err.message);
        }
    }
}

testStats();
