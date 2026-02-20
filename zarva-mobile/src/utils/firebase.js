/**
 * src/utils/firebase.js
 * Initializes the Firebase Realtime Database for client-side listeners
 */
import { initializeApp } from 'firebase/app';
import { getDatabase, connectDatabaseEmulator } from 'firebase/database';

const firebaseConfig = {
    // These would normally be real config vars.
    // Since we are mocking/stubbing heavily, we just need the DB to initialize cleanly.
    apiKey: "dummy-api-key",
    authDomain: "zarva-dev.firebaseapp.com",
    databaseURL: "https://zarva-dev-default-rtdb.firebaseio.com",
    projectId: "zarva-dev",
    storageBucket: "zarva-dev.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// In a local dev environment using Firebase Emulator:
// connectDatabaseEmulator(db, 'localhost', 9000);

export { db };
