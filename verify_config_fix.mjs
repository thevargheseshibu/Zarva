
import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.development') });

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

async function testConfig() {
    console.log(`Testing ${API_URL}/api/jobs/config ...`);
    try {
        const res = await axios.get(`${API_URL}/api/jobs/config`);
        console.log('Status:', res.status);
        if (res.data && res.data.categories) {
            console.log('SUCCESS: Categories found:', Object.keys(res.data.categories).length);
        } else {
            console.log('FAILURE: Response missing categories');
        }
    } catch (err) {
        if (err.response) {
            console.log('Status:', err.response.status);
            console.log('Data:', err.response.data);
            if (err.response.status === 401 || err.response.status === 403) {
                 console.log('SUCCESS: Route exists (access denied as expected).');
            } else {
                 console.log('FAILURE: Endpoint returned error status.');
            }
        } else {
            console.log('Error:', err.message);
        }
    }
}

testConfig();
