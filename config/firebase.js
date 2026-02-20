/**
 * config/firebase.js — Firebase Admin SDK singleton
 *
 * Lazy-initialises the app on first call.
 * If env vars are missing (dev mode), initialisation is skipped and
 * verifyIdToken() returns null — the caller must handle this gracefully.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

let _app = null;
let _admin = null;

/**
 * Initialise (or return cached) Firebase Admin app.
 * Returns null when Firebase env vars are not configured.
 *
 * @returns {import('firebase-admin').app.App | null}
 */
function getFirebaseApp() {
    if (_app) return _app;

    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        console.warn('[Firebase] Env vars missing — running in stub mode (dev only).');
        return null;
    }

    // Lazy-require to avoid slowing down test runs that never call this
    _admin = require('firebase-admin');

    // Avoid re-initialising if somehow already done
    if (_admin.apps.length > 0) {
        _app = _admin.apps[0];
        return _app;
    }

    _app = _admin.initializeApp({
        credential: _admin.credential.cert({
            projectId,
            clientEmail,
            // GCP stores newlines as literal \n in env vars
            privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
    });

    console.log('[Firebase] Admin SDK initialised for project:', projectId);
    return _app;
}

/**
 * Verify a Firebase ID token and return its decoded payload.
 * Returns null when Firebase is not configured (dev stub mode).
 *
 * @param {string} idToken
 * @returns {Promise<object|null>}
 */
async function verifyIdToken(idToken) {
    const app = getFirebaseApp();
    if (!app) return null;

    return _admin.auth(app).verifyIdToken(idToken);
}

export { getFirebaseApp, verifyIdToken };
