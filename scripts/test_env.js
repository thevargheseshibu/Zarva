
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

function getTestPhoneMap() {
    let raw = process.env.TEST_PHONE_NUMBERS || '';
    const map = new Map();
    raw = raw.replace(/[\[\]'"]/g, '');
    raw.split(',').forEach(pair => {
        const [phone, otp] = pair.trim().split(':');
        if (phone && otp) map.set(phone.trim(), otp.trim());
    });
    return map;
}

const map = getTestPhoneMap();
console.log('Parsed test phones:', Array.from(map.entries()));
console.log('Value for 9746020743:', map.get('9746020743'));
console.log('Is 123456 matched?', map.get('9746020743') === '123456');
