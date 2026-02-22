import { initializeApp, cert } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccount = JSON.parse(
    readFileSync(path.join(__dirname, 'firebase-service-account.json'), 'utf8')
);

initializeApp({
    credential: cert(serviceAccount)
});

const messaging = getMessaging();

// Hardcoded explicit device registration token
// Note: We'll retrieve the FCM token dynamically inside the script by running a quick db poll or hardcoding the console print.
const targetToken = "f9LTPuczRbmKtDbiELN7Ej:APA91bFncoNcc2ERa9RuZd1w5fT7ZDBQsU_wRUx9XMjug8ijGlFmrQNdXcQ2zKa1OHoVWunnCWzr4scxrfT2PgqBR7SZPUpHURXcPl05e-fge5APByiVuIc";

async function testPush() {
    console.log("Starting FCM Test Push to Expo Android...");
    const message = {
        token: targetToken,
        notification: {
            title: 'Test Alert: New Job',
            body: 'This is a test from the manual script.'
        },
        data: {
            type: 'NEW_JOB_ALERT',
            job_id: '999',
            category: 'Plumbing',
            category_icon: '🔧',
            distance_km: '2.5',
            customer_area: 'Test City',
            description_snippet: 'Fix my sink please',
            estimated_earnings: '450',
            is_emergency: '1',
            accept_window_seconds: '30',
            wave_number: '1'
        },
        android: {
            priority: 'high',
            notification: {
                channelId: 'job_alerts',
                sound: 'job_alert' // references assets/sounds/job_alert.mp3
            }
        },
        apns: {
            payload: {
                aps: {
                    sound: 'job_alert.caf',
                    badge: 1,
                    'content-available': 1
                }
            }
        }
    };

    try {
        const res = await messaging.send(message);
        console.log("✅ Successfully sent test message!", res);
    } catch (err) {
        console.error("❌ Failed to send:", err);
    }
}

testPush();
