/**
 * services/fcmService.js
 * 
 * Handles push notifications to mobile devices via Firebase Cloud Messaging.
 */
import { getMessaging } from '../config/firebase.js';
import { getPool } from '../config/database.js';

/**
 * Dispatches a 'NEW_JOB' data-only push notification to an array of eligible workers.
 * Nullifies any tokens that result in 'messaging/registration-token-not-registered'.
 * 
 * @param {string|number} jobId 
 * @param {Array} workers - Array of { user_id, fcm_token, distance_km }
 */
export async function sendJobAlertToWorkers(jobId, workers) {
    const validTokensMap = new Map(); // token -> user_id

    workers.forEach(w => {
        if (w.fcm_token) {
            validTokensMap.set(w.fcm_token, w.user_id);
        }
    });

    const tokens = Array.from(validTokensMap.keys());

    if (tokens.length === 0) {
        console.log(`[FCM Service] No valid tokens provided for Job ${jobId}`);
        return;
    }

    const messaging = getMessaging();
    if (!messaging) {
        console.log(`[FCM Mock] Sending NEW_JOB alert to ${tokens.length} devices for job ${jobId}`);
        return;
    }

    const message = {
        tokens,
        // Using data-only messages for custom background processing in React Native
        data: {
            type: 'NEW_JOB',
            jobId: String(jobId)
        },
        android: {
            priority: 'high'
        },
        apns: {
            headers: {
                'apns-priority': '10'
            }
        }
    };

    try {
        const response = await messaging.sendEachForMulticast(message);
        console.log(`[FCM Service] Multicast success: ${response.successCount}, fail: ${response.failureCount}`);

        // Handle stale/unregistered tokens
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errCode = resp.error?.code;
                    // 'messaging/invalid-registration-token' or 'messaging/registration-token-not-registered'
                    if (errCode === 'messaging/invalid-registration-token' ||
                        errCode === 'messaging/registration-token-not-registered') {
                        failedTokens.push(tokens[idx]);
                    }
                }
            });

            if (failedTokens.length > 0) {
                await pruneStaleTokens(failedTokens, validTokensMap);
            }
        }
    } catch (err) {
        console.error(`[FCM Service] Error sending multicast message:`, err);
    }
}

async function pruneStaleTokens(staleTokens, tokenToUserMap) {
    try {
        console.log(`[FCM Service] Pruning ${staleTokens.length} stale FCM tokens...`);
        const userIdsToPrune = staleTokens.map(token => tokenToUserMap.get(token)).filter(Boolean);

        if (userIdsToPrune.length === 0) return;

        const pool = getPool();
        const placeholders = userIdsToPrune.map(() => '?').join(',');

        await pool.query(
            `UPDATE users SET fcm_token = NULL WHERE id IN (${placeholders})`,
            userIdsToPrune
        );
        console.log(`[FCM Service] Successfully pruned stale tokens from DB.`);
    } catch (err) {
        console.error(`[FCM Service] Error pruning stale tokens:`, err);
    }
}
