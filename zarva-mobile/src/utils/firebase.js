/**
 * src/utils/firebase.js
 * Initializes the Firebase Realtime Database for client-side listeners
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

const firebaseConfig = {
    // These would normally be real config vars.
    // Since we are mocking/stubbing heavily, we just need the DB to initialize cleanly.
    apiKey: "dummy-api-key",
    authDomain: "zarva-dev.firebaseapp.com",
    databaseURL: "https://zarva-dev-741f9-default-rtdb.firebaseio.com",
    projectId: "zarva-dev-741f9",
    storageBucket: "zarva-dev-741f9.firebasestorage.app",
    messagingSenderId: "1074706915162",
    appId: "1:1074706915162:web:e4e3bdc605d3b64cd46b41"
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getDatabase(app);

// In a local dev environment using Firebase Emulator:
// connectDatabaseEmulator(db, 'localhost', 9000);

export { db };
