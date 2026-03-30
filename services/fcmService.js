/**
 * services/fcmService.js
 * 
 * Handles push notifications to mobile devices via Firebase Cloud Messaging.
 */
import { getMessaging } from '../config/firebase.js';
import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';
import { calculatePricing } from '../utils/pricingEngine.js';

/**
 * Helper to get icon for category dynamically from the central jobs config
 */
function getCategoryIcon(cat) {
    try {
        const jobsCfg = configLoader.get('jobs');
        const catInfo = jobsCfg.categories[cat];
        if (catInfo && catInfo.label) {
            // Attempt to extract an emoji/icon from the label (e.g. "⚡ Electrician")
            const match = catInfo.label.match(/^([^\w\s]+)\s+(.*)$/u) || catInfo.label.match(/^(\p{Emoji_Presentation}|\p{Emoji}\uFE0F|\p{Emoji_Modifier_Base})\s+(.*)$/u);
            if (match) {
                return match[1];
            }
        }
    } catch (e) {
        console.warn(`[FCM Service] Failed to lookup icon for category ${cat}`);
    }
    return '🛠️'; // Centralized fallback
}

/**
 * Calculates estimated earnings for the worker (subtotal).
 */
function calculateEstimatedEarnings(job, distanceKm) {
    const pricingConfig = configLoader.get('jobs');
    const pricing = calculatePricing({
        category: job.category,
        hours: job.estimated_hours || 0,
        travelKm: distanceKm,
        isEmergency: Boolean(job.is_emergency),
        scheduledAt: job.scheduled_at
    }, pricingConfig);
    return Math.round(pricing.worker_payout);
}

/**
 * Dispatches a 'NEW_JOB_ALERT' data-only push notification to each worker individually
 * so we can include worker-specific distance and earnings.
 */
export async function sendJobAlertToWorkers(jobId, workers, job, waveNum) {
    const messaging = getMessaging();
    const matchingConfig = configLoader.get('zarva')?.matching || { worker_accept_window_seconds: 30 };
    
    // Safety check: Filter out the customer themselves to prevent self-notification
    const targetWorkers = workers.filter(w => String(w.user_id) !== String(job.customer_id));

    if (targetWorkers.length === 0) {
        console.log(`[FCM Service] Job ${jobId}: No workers to notify after filtering out customer.`);
        return;
    }

    console.log(`[FCM Service] Dispatching Job ${jobId} Alert to ${targetWorkers.length} workers (Wave ${waveNum})`);

    // We send individual messages because distance_km and earnings are specific to each worker
    const messages = targetWorkers.map(worker => {
        const safeDistance = Number(worker.distance_km) || 0;
        let estEarnings = 0;
        try {
            estEarnings = calculateEstimatedEarnings(job, safeDistance);
        } catch (e) {
            console.warn(`[FCM Service] calculateEstimatedEarnings failed for ${job.category}:`, e.message);
        }

        console.log(`[FCM Service] Building message for worker ${worker.user_id}, token: ${worker.fcm_token?.slice(0, 20)}...`);

        return {
            token: worker.fcm_token,
            notification: {
                title: 'New Job Available!',
                body: `${getCategoryIcon(job.category)} ${job.category} job ${safeDistance.toFixed(1)}km away. Earn est. ₹${estEarnings}`
            },
            data: {
                type: 'NEW_JOB_ALERT',
                job_id: String(jobId),
                category: job.category,
                category_icon: getCategoryIcon(job.category),
                distance_km: String(safeDistance.toFixed(1)),
                customer_area: job.address || 'Nearby',
                description_snippet: (job.description || '').slice(0, 80),
                estimated_earnings: String(estEarnings),
                is_emergency: String(job.is_emergency || 0),
                accept_window_seconds: String(matchingConfig.worker_accept_window_seconds || 30),
                wave_number: String(waveNum),
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'job_alerts',
                    sound: 'job_alert'
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
    });

    if (!messaging) {
        console.log(`[FCM Mock] Individual alerts for job ${jobId} would be sent now.`);
        return;
    }

    try {
        const response = await messaging.sendEach(messages);
        console.log(`[FCM Service] Dispatch result — success: ${response.successCount}, fail: ${response.failureCount}`);

        const staleTokens = [];
        response.responses.forEach((resp, idx) => {
            const worker = workers[idx];
            if (resp.success) {
                console.log(`[FCM Service] ✅ Sent OK to worker ${worker.user_id} | messageId: ${resp.messageId}`);
            } else {
                const errCode = resp.error?.code || 'UNKNOWN';
                const errMsg = resp.error?.message || '';
                console.error(`[FCM Service] ❌ Failed for worker ${worker.user_id} | code: ${errCode} | ${errMsg}`);
                if (errCode === 'messaging/invalid-registration-token' ||
                    errCode === 'messaging/registration-token-not-registered') {
                    staleTokens.push(messages[idx].token);
                }
            }
        });

        if (staleTokens.length > 0) {
            console.warn(`[FCM Service] ${staleTokens.length} stale token(s) detected — will prune from DB.`);
            // Prune via token match
            const pool = getPool();
            for (const token of staleTokens) {
                await pool.query('UPDATE users SET fcm_token = NULL WHERE fcm_token = $1', [token]);
            }
        }
    } catch (err) {
        console.error(`[FCM Service] Fatal error during sendEach dispatch:`, err.message, err.stack);
    }
}

async function pruneStaleTokens(staleTokens, tokenToUserMap) {
    try {
        console.log(`[FCM Service] Pruning ${staleTokens.length} stale FCM tokens...`);
        const userIdsToPrune = staleTokens.map(token => tokenToUserMap.get(token)).filter(Boolean);

        if (userIdsToPrune.length === 0) return;

        const pool = getPool();
        const placeholders = userIdsToPrune.map((_, i) => `$${i + 1}`).join(',');

        await pool.query(
            `UPDATE users SET fcm_token = NULL WHERE id IN (${placeholders})`,
            userIdsToPrune
        );
        console.log(`[FCM Service] Successfully pruned stale tokens from DB.`);
    } catch (err) {
        console.error(`[FCM Service] Error pruning stale tokens:`, err);
    }
}

/**
 * Dispatches a 'chat_message' push notification to a specific user.
 */
export async function sendChatNotification(jobId, recipientId, senderName, messagePreview, messageType) {
    const messaging = getMessaging();
    if (!messaging) {
        console.log(`[FCM Mock] Chat alert to user ${recipientId}: ${messagePreview}`);
        return;
    }

    try {
        const pool = getPool();
        const [users] = await pool.query('SELECT id, fcm_token FROM users WHERE id = $1', [recipientId]);
        
        if (!users.length || !users[0].fcm_token) {
            console.log(`[FCM Service] Cannot send chat to ${recipientId}: No FCM token.`);
            return;
        }

        const token = users[0].fcm_token;
        
        const message = {
            token: token,
            notification: {
                // Ensure notification fields are strictly strings
                title: String(senderName || 'New Message'),
                body: String(messagePreview || 'You have a new message')
            },
            data: {
                // FIX: Match frontend router expectation and strictly cast ALL values to Strings
                type: 'chat_message', 
                job_id: String(jobId || ''),
                sender_name: String(senderName || 'User'),
                
                // 🚨 FIX: 'message_type' is an FCM Reserved Word! We must use 'msg_type' instead.
                msg_type: String(messageType || 'text')
            },
            android: {
                priority: 'high',
                notification: {
                    channelId: 'zarva_default' // Make sure this matches your created channel in fcm.init.js
                }
            },
            apns: {
                payload: {
                    aps: {
                        badge: 1,
                        sound: 'default',
                        'content-available': 1
                    }
                }
            }
        };

        const response = await messaging.send(message);
        console.log(`[FCM Service] Chat notification sent successfully: ${response}`);
    } catch (err) {
        console.error(`[FCM Service] Failed to send chat notification to user ${recipientId}:`, err);
        // Clean up stale tokens
        if (err.code === 'messaging/invalid-registration-token' || err.code === 'messaging/registration-token-not-registered') {
            const pool = getPool();
            await pool.query('UPDATE users SET fcm_token = NULL WHERE id = $1', [recipientId]);
        }
    }
}
