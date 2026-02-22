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
 * Helper to get icon for category
 */
function getCategoryIcon(cat) {
    const icons = {
        'Electrician': '⚡',
        'Plumber': '🔧',
        'Carpenter': '🔨',
        'AC Repair': '❄️',
        'Painter': '🖌️',
        'Cleaning': '🧹'
    };
    return icons[cat] || '🛠️';
}

/**
 * Calculates estimated earnings for the worker (subtotal).
 */
function calculateEstimatedEarnings(job, distanceKm) {
    const pricingConfig = configLoader.get('pricing');
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

    if (workers.length === 0) return;

    console.log(`[FCM Service] Dispatching Job ${jobId} Alert to ${workers.length} workers (Wave ${waveNum})`);

    // We send individual messages because distance_km and earnings are specific to each worker
    const messages = workers.map(worker => {
        const estEarnings = calculateEstimatedEarnings(job, worker.distance_km);

        return {
            token: worker.fcm_token,
            notification: {
                title: 'New Job Available!',
                body: `${getCategoryIcon(job.category)} ${job.category} job ${worker.distance_km.toFixed(1)}km away. Earn est. ₹${estEarnings}`
            },
            data: {
                type: 'NEW_JOB_ALERT',
                job_id: String(jobId),
                category: job.category,
                category_icon: getCategoryIcon(job.category),
                distance_km: String(worker.distance_km.toFixed(1)),
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
    });

    if (!messaging) {
        console.log(`[FCM Mock] Individual alerts for job ${jobId} would be sent now.`);
        return;
    }

    try {
        const response = await messaging.sendEach(messages);
        console.log(`[FCM Service] Individual dispatch success: ${response.successCount}, fail: ${response.failureCount}`);

        // Pruning stale tokens if needed (simplified for individual send)
        if (response.failureCount > 0) {
            const staleTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    const errCode = resp.error?.code;
                    if (errCode === 'messaging/invalid-registration-token' ||
                        errCode === 'messaging/registration-token-not-registered') {
                        staleTokens.push(messages[idx].token);
                    }
                }
            });
            if (staleTokens.length > 0) {
                // We'd need a token-to-user-id map here, or just prune by token if we had that endpoint
                console.log(`[FCM Service] ${staleTokens.length} tokens marked for pruning.`);
            }
        }
    } catch (err) {
        console.error(`[FCM Service] Error during individual dispatch:`, err);
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
