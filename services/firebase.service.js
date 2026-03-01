/**
 * services/firebase.service.js
 *
 * Centralised Firebase Realtime Database helpers for ZARVA.
 * All functions are stub-safe: if Firebase is not configured or
 * live_tracking_enabled=false, they log a mock string and return.
 */

import { getDatabase } from '../config/firebase.js';
import configLoader from '../config/loader.js';

const isLiveTracking = () =>
    configLoader.get('features')?.location?.live_tracking_enabled ?? true;

// ── Internal helper ──────────────────────────────────────────────────────────

async function dbRef(path) {
    const db = getDatabase();
    if (!db) return null;
    return db.ref(path);
}

// ── Public helpers ───────────────────────────────────────────────────────────

/**
 * worker_presence/{workerId} = { is_online, lat, lng, current_job_id, last_seen }
 * Also sets onDisconnect handler → is_online=false on connection drop (crash safety).
 */
export async function updateWorkerPresence(workerId, data) {
    if (!isLiveTracking()) return;
    const db = getDatabase();
    if (!db) {
        console.log(`[Firebase Mock] worker_presence/${workerId} =`, JSON.stringify({ ...data, last_seen: Date.now() }));
        // Log intended onDisconnect so the behaviour is visible in dev/tests
        if (data.is_online === true) {
            console.log(`[Firebase Mock] onDisconnect worker_presence/${workerId}/is_online = false (crash-safety registered)`);
        }
        return;
    }
    const ref = db.ref(`worker_presence/${workerId}`);
    await ref.update({ ...data, last_seen: Date.now() });

    // Register crash-safety: if this server connection drops, mark worker offline
    if (data.is_online === true) {
        await ref.onDisconnect().update({ is_online: false, last_seen: Date.now() });
    }
}


/**
 * Merge fields into active_jobs/{jobId}.
 */
export async function updateJobNode(jobId, fields) {
    if (!isLiveTracking()) return;
    const ref = await dbRef(`active_jobs/${jobId}`);
    if (!ref) {
        console.log(`[Firebase Mock] active_jobs/${jobId} update =`, JSON.stringify(fields));
        return;
    }
    await ref.update({ ...fields, last_updated: Date.now() });
}


export async function createJobNode(jobId, workerId, customerLat, customerLng, worker = null) {
    const data = {
        status: 'assigned',
        worker_id: workerId,
        customer_lat: customerLat,
        customer_lng: customerLng,
        worker_lat: null,
        worker_lng: null,
        worker_heading: null,
        eta_minutes: null,
        start_otp_done: false,
        end_otp_done: false,
        timer_started_at: null,
        last_updated: Date.now()
    };

    if (worker) {
        data.worker = {
            name: worker.name || 'Worker',
            rating: worker.rating || 5.0,
            photo: worker.photo || 'https://ui-avatars.com/api/?name=Worker'
        };
    }

    const ref = await dbRef(`active_jobs/${jobId}`);
    if (!ref) {
        console.log(`[Firebase Mock] active_jobs/${jobId} created =`, JSON.stringify(data));
        return;
    }
    await ref.set(data);
}

/**
 * Remove the job node on completion or cancellation.
 */
export async function clearJobNode(jobId) {
    if (!isLiveTracking()) return;
    const ref = await dbRef(`active_jobs/${jobId}`);
    if (!ref) {
        console.log(`[Firebase Mock] active_jobs/${jobId} removed`);
        return;
    }
    await ref.remove();
}

/**
 * Update status + optional extra fields on active_jobs/{jobId}.
 */
export async function updateJobStatus(jobId, status, extraFields = {}) {
    return updateJobNode(jobId, { status, ...extraFields });
}

/**
 * Read worker presence — stub returns mock coords in dev mode.
 */
export async function readWorkerPresence(workerId) {
    const ref = await dbRef(`worker_presence/${workerId}`);
    if (!ref) {
        return {
            is_online: true,
            lat: 10.0261,
            lng: 76.3083,
            current_job_id: null,
            last_seen: Date.now(),
            _mock: true
        };
    }
    const snap = await ref.once('value');
    return snap.val();
}

// ── Chat System Helpers ──────────────────────────────────────────────────────

export async function updateJobChatUnread(jobId, userId, count) {
    if (!isLiveTracking()) return;
    const ref = await dbRef(`active_jobs/${jobId}/chat_unread/${userId}`);
    if (!ref) return;
    await ref.set(count);
}

export async function updateJobLastMessage(jobId, data) {
    if (!isLiveTracking()) return;
    const ref = await dbRef(`active_jobs/${jobId}/chat_last_message`);
    if (!ref) return;
    await ref.set(data);
}

export async function updateJobTyping(jobId, userId) {
    if (!isLiveTracking()) return;
    const ref = await dbRef(`active_jobs/${jobId}/chat_typing/${userId}`);
    if (!ref) return;
    // Set timestamp, client can assume typing is true if timestamp is within last 3 seconds
    await ref.set(Date.now());
}

// ── Support Ticket Helpers ───────────────────────────────────────────────────

export async function pushTicketMessage(ticketId, messageData) {
    if (!isLiveTracking()) return;
    const ref = await dbRef(`support_tickets/${ticketId}/messages`);
    if (!ref) {
        console.log(`[Firebase Mock] support_tickets/${ticketId}/messages pushed =`, JSON.stringify(messageData));
        return;
    }
    // Push adds a new unique child node
    const newMessageRef = ref.push();
    await newMessageRef.set(messageData);

    // Update last_activity directly on the ticket root in Firebase
    const ticketRef = await dbRef(`support_tickets/${ticketId}`);
    if (ticketRef) {
        await ticketRef.update({
            last_activity_at: Date.now(),
            last_message_preview: messageData.message_text ? messageData.message_text.substring(0, 50) : 'Attachment'
        });
    }
}

// ── Extension Request Helpers ────────────────────────────────────────────────

export async function updateExtensionNode(jobId, data) {
    if (!isLiveTracking()) {
        console.log(`[Firebase Mock] active_jobs/${jobId}/extension update =`, JSON.stringify(data));
        return;
    }
    const ref = await dbRef(`active_jobs/${jobId}/extension`);
    if (!ref) return;
    await ref.update({ ...data, updated_at: Date.now() });
}

