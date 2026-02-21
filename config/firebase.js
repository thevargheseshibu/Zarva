/**
 * config/firebase.js — Firebase Admin SDK singleton
 *
 * Lazy-initialises the app on first call.
 * If env vars are missing (dev mode), all helpers return null.
 * Callers must handle null gracefully.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

let _app = null;
let _admin = null;
let _db = null;

/**
 * Initialise (or return cached) Firebase Admin app.
 * Returns null when Firebase env vars are not configured.
 */
function getFirebaseApp() {
    if (_app) return _app;

    _admin = require('firebase-admin');

    // Expose globally so firebase.service.js can access without re-require
    globalThis.__firebaseAdmin = _admin;

    if (_admin.apps.length > 0) {
        _app = _admin.apps[0];
        return _app;
    }

    // Try service account file first
    try {
        const rootDir = path.resolve(fileURLToPath(import.meta.url), '../../');
        const keyPath = path.join(rootDir, 'firebase-service-account.json');

        if (fs.existsSync(keyPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
            _app = _admin.initializeApp({
                credential: _admin.credential.cert(serviceAccount),
                databaseURL: process.env.FIREBASE_DATABASE_URL,
            });
            console.log('[Firebase] Admin SDK initialised from firebase-service-account.json');
            return _app;
        }
    } catch (e) {
        console.warn('[Firebase] Failed to load service account key:', e.message);
    }

    // Fallback to env vars
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        console.warn('[Firebase] Env vars missing & no JSON key found — running in stub mode (dev only).');
        return null;
    }

    _app = _admin.initializeApp({
        credential: _admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
        databaseURL: process.env.FIREBASE_DATABASE_URL,
    });

    console.log('[Firebase] Admin SDK initialised from ENV for project:', projectId);
    return _app;
}

/**
 * Returns the Firebase Realtime Database instance, or null in stub mode.
 */
function getDatabase() {
    if (_db) return _db;
    const app = getFirebaseApp();
    if (!app) return null;
    if (!process.env.FIREBASE_DATABASE_URL) {
        console.warn('[Firebase] FIREBASE_DATABASE_URL not set — RTDB unavailable.');
        return null;
    }
    _db = _admin.database(app);
    return _db;
}

/**
 * Verify a Firebase ID token and return its decoded payload.
 * Returns null when Firebase is not configured (dev stub mode).
 */
async function verifyIdToken(idToken) {
    const app = getFirebaseApp();
    if (!app) return null;
    return _admin.auth(app).verifyIdToken(idToken);
}

/**
 * Returns the Firebase Messaging instance, or null in stub mode.
 */
function getMessaging() {
    const app = getFirebaseApp();
    if (!app || !globalThis.__firebaseAdmin) return null;
    return globalThis.__firebaseAdmin.messaging(app);
}

export { getFirebaseApp, getDatabase, verifyIdToken, getMessaging };
