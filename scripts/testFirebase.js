import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import admin from 'firebase-admin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const SERVICE_ACCOUNT_PATH = path.join(rootDir, 'firebase-service-account.json');

async function runTests() {
    let serviceAccountPassed = false;
    let sdkInitPassed = false;
    let rtdbPassed = false;
    let fcmPassed = false;

    let serviceAccount = null;

    console.log('Running Firebase Connection Tests...\n');

    // Test 1 — Service account file loads correctly
    try {
        if (!fs.existsSync(SERVICE_ACCOUNT_PATH)) {
            throw new Error(`File not found at ${SERVICE_ACCOUNT_PATH}`);
        }

        const fileContent = fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8');
        serviceAccount = JSON.parse(fileContent);

        if (!serviceAccount.project_id) {
            throw new Error('Invalid JSON: missing project_id field');
        }

        console.log('✅ PASS — Service account file loaded');
        console.log(`   Project ID: ${serviceAccount.project_id}\n`);
        serviceAccountPassed = true;
    } catch (error) {
        console.log('❌ FAIL — Service account file not found or invalid JSON');
        console.log('   Fix: Make sure firebase-service-account.json is in your backend root folder\n');
    }

    // Test 2 — Firebase Admin SDK initializes
    try {
        if (!serviceAccountPassed) {
            throw new Error('Skipping SDK Init due to missing service account');
        }

        if (!process.env.FIREBASE_DATABASE_URL) {
            throw new Error('FIREBASE_DATABASE_URL is not set in .env');
        }

        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.FIREBASE_DATABASE_URL
        });

        console.log('✅ PASS — Firebase Admin SDK initialized\n');
        sdkInitPassed = true;
    } catch (error) {
        console.log('❌ FAIL — Firebase Admin SDK failed to initialize');
        console.log(`   Error: ${error.message}`);
        console.log('   Fix: Check your firebase-service-account.json is not corrupted and FIREBASE_DATABASE_URL is set in .env\n');
    }

    // Test 3 — Realtime Database read and write
    try {
        if (!sdkInitPassed) throw new Error('SDK not initialized');

        const db = admin.database();
        const testRef = db.ref('zarva/connection_test');
        const testPayload = { status: 'ok', tested_at: Date.now() };

        // Write
        await testRef.set(testPayload);

        // Read back
        const snapshot = await testRef.once('value');
        const data = snapshot.val();

        if (data && data.status === 'ok') {
            console.log('✅ PASS — Realtime Database write and read working');
            console.log(`   URL: ${process.env.FIREBASE_DATABASE_URL}`);
            console.log(`   Written and read back: ${JSON.stringify(data)}\n`);
            rtdbPassed = true;
        } else {
            throw new Error('Data read back did not match what was written');
        }

        // Cleanup
        await testRef.remove();
    } catch (error) {
        console.log('❌ FAIL — Realtime Database not reachable');
        console.log(`   Error: ${error.message}`);
        console.log('   Fix: Check FIREBASE_DATABASE_URL in .env matches exactly what is shown in Firebase console\n');
    }

    // Test 4 — FCM (Cloud Messaging) is reachable
    try {
        if (!sdkInitPassed) throw new Error('SDK not initialized');

        const messaging = admin.messaging();

        // This will deliberately fail, but we check the specific error code to confirm FCM connection
        await messaging.send({
            token: 'test_invalid_token_zarva',
            notification: {
                title: 'Test',
                body: 'Test Notification'
            }
        });

        // Shouldn't reach here because token is invalid
        console.log('❌ FAIL — FCM not reachable or credentials rejected');
        console.log('   Error message: Send succeeded unexpectedly with fake token\n');

    } catch (error) {
        if (
            error.code === 'messaging/invalid-registration-token' ||
            error.code === 'messaging/invalid-argument' ||
            error.code === 'messaging/registration-token-not-registered'
        ) {
            console.log('✅ PASS — FCM (Cloud Messaging) is reachable');
            console.log('   Got expected invalid-token error which confirms FCM is connected\n');
            fcmPassed = true;
        } else {
            console.log('❌ FAIL — FCM not reachable or credentials rejected');
            console.log(`   Error code: ${error.code}`);
            console.log(`   Error message: ${error.message}`);
            console.log('   Fix: Check your service account has Cloud Messaging permissions in Firebase console\n');
        }
    }

    // Final summary
    console.log('─────────────────────────────────');
    console.log('FIREBASE CONNECTION TEST SUMMARY');
    console.log('─────────────────────────────────');
    console.log(`Service Account File   : ${serviceAccountPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Admin SDK Init         : ${sdkInitPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Realtime Database      : ${rtdbPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`Cloud Messaging (FCM)  : ${fcmPassed ? '✅ PASS' : '❌ FAIL'}`);
    console.log('─────────────────────────────────');

    if (serviceAccountPassed && sdkInitPassed && rtdbPassed && fcmPassed) {
        console.log('All systems go. Firebase is ready for Zarva.');
        process.exit(0);
    } else {
        const failures = [serviceAccountPassed, sdkInitPassed, rtdbPassed, fcmPassed].filter(v => !v).length;
        console.log(`${failures} test(s) failed. Fix the issues above and run again.`);
        process.exit(1);
    }
}

runTests();
