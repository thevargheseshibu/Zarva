import { getPool } from '../config/database.js';
import { getFirebaseApp } from '../config/firebase.js';

export class CustomJobService {
    constructor() {
        this.BROADCAST_RADIUS_KM = 25;
    }

    async createTemplate(customerId, data) {
        let { title, description, photos = [], hourly_rate, fee_negotiable = false, city, state, pincode } = data;
        const pool = getPool();

        // ⭐ ANTI-SPAM: Max 3 pending templates per user
        const [pending] = await pool.query(`SELECT COUNT(*) as count FROM custom_job_templates WHERE customer_id = $1 AND approval_status = 'pending'`, [customerId]);
        if (Number(pending[0].count) >= 3) {
            throw Object.assign(new Error('You have too many pending custom requests. Please wait for admin approval.'), { status: 429 });
        }

        let parsedPhotos = Array.isArray(photos) ? photos : [];
        if (typeof photos === 'string') {
            try { parsedPhotos = JSON.parse(photos); } catch (e) { parsedPhotos = []; }
        }

        const rate = Number(hourly_rate);
        const isNegotiable = fee_negotiable === 'true' || fee_negotiable === true;

        if (!title || title.length > 200) throw Object.assign(new Error('Title must be 1-200 characters'), { status: 400 });
        if (!description || description.trim().length < 30) throw Object.assign(new Error('Description must be at least 30 characters'), { status: 400 });
        if (isNaN(rate) || rate < 50 || rate > 100000) throw Object.assign(new Error('Invalid hourly rate'), { status: 400 });

        const [result] = await pool.query(
            `INSERT INTO custom_job_templates (
                customer_id, title, description, photos, hourly_rate, fee_negotiable,
                city, state, pincode, approval_status
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending') RETURNING id`,
            [customerId, title, description, parsedPhotos, rate, isNegotiable, city || null, state || null, pincode || null]
        );

        const templateId = result[0].id;
        try {
            const app = getFirebaseApp();
            if (app) {
                await globalThis.__firebaseAdmin.messaging(app).sendToTopic('admin_custom_jobs', {
                    notification: { title: 'New Custom Job Pending', body: `"${title}" needs approval.` },
                    data: { type: 'custom_job_review', template_id: String(templateId) }
                });
            }
        } catch (e) { console.warn('Failed to send admin FCM', e.message); }

        return { template_id: templateId, status: 'pending' };
    }

    async getMyTemplates(customerId) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT * FROM custom_job_templates WHERE customer_id = $1 AND is_archived = FALSE ORDER BY created_at DESC`, [customerId]
        );
        return rows;
    }

    async adminApproveTemplate(adminId, templateId, notes, estimatedCost) {
        const pool = getPool();
        
        // 1. Update state
        await pool.query(
            `UPDATE custom_job_templates SET approval_status = 'approved', is_active = TRUE, reviewed_by = $1, reviewed_at = NOW(), admin_notes = $2, estimated_cost = $3 WHERE id = $4`, 
            [adminId, notes, estimatedCost || null, templateId]
        );
        
        // 2. Fetch Customer FCM device_token
        const [jobDetails] = await pool.query(
            `SELECT t.title, u.fcm_token 
             FROM custom_job_templates t
             JOIN users u ON t.customer_id = u.id
             WHERE t.id = $1`,
            [templateId]
        );
        
        const template = jobDetails[0];

        // 3. Trigger Push Notification
        if (template && template.fcm_token) {
            try {
                const app = getFirebaseApp();
                if (app) {
                    await globalThis.__firebaseAdmin.messaging(app).send({
                        token: template.fcm_token,
                        notification: {
                            title: 'Custom Job Approved! ✅',
                            body: `Your request "${template.title}" is approved and ready. Open Zarva to post it live!`
                        },
                        data: { type: 'custom_job_approved', template_id: String(templateId) }
                    });
                }
            } catch (err) {
                console.warn('[FCM] Customer notification failed:', err.message);
            }
        }

        return { success: true };
    }

    async adminRejectTemplate(adminId, templateId, reason) {
        const pool = getPool();
        await pool.query(`UPDATE custom_job_templates SET approval_status = 'rejected', is_active = FALSE, rejection_reason = $1, reviewed_by = $2, reviewed_at = NOW() WHERE id = $3`, [reason, adminId, templateId]);
        return { success: true };
    }

    async postJobFromTemplate(customerId, templateId, locationData) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            const [templates] = await conn.query(`SELECT * FROM custom_job_templates WHERE id = $1 AND customer_id = $2 FOR UPDATE`, [templateId, customerId]);
            const template = templates[0];

            if (!template || template.approval_status !== 'approved') throw Object.assign(new Error('Template must be approved to post'), { status: 400 });

            // ⭐ FIX: Status changed from 'open' to 'searching' to align with worker.service.js state machine
            const idempotencyKey = `custom_${templateId}_${Date.now()}`;
            const [jobRes] = await conn.query(
                `INSERT INTO jobs (
                    idempotency_key, customer_id, category, status,
                    address, customer_address_detail, job_location, location_source,
                    latitude, longitude, pincode, city, district,
                    description, rate_per_hour, advance_amount, travel_charge, billing_type
                ) VALUES ($1, $2, 'custom', 'searching', $3, $4, ST_GeogFromText($5), $6, $7, $8, $9, $10, $11, $12, $13, 0, 0, 'hourly') RETURNING id`,
                [
                    idempotencyKey, customerId, locationData.address || template.city, JSON.stringify(locationData.address_detail || {}),
                    locationData.location_st, locationData.source || 'gps', locationData.latitude, locationData.longitude,
                    template.pincode, template.city, template.state, template.description, template.hourly_rate
                ]
            );

            const jobId = jobRes[0].id;
            await conn.query(`INSERT INTO custom_job_instances (job_id, template_id, agreed_hourly_rate) VALUES ($1, $2, $3)`, [jobId, templateId, template.hourly_rate]);
            await conn.commit();

            // ⭐ FIX: Synchronize to Firebase so chat and ActiveJobScreen do not crash
            const { updateJobNode } = await import('./firebase.service.js');
            await updateJobNode(jobId, {
                status: 'searching',
                category: 'custom',
                customer_id: customerId,
                description: template.description,
                hourly_rate: template.hourly_rate,
                created_at: new Date().toISOString()
            });

            this.broadcastCustomJob(jobId, template, { lat: locationData.latitude, lng: locationData.longitude }).catch(console.error);
            return { job_id: jobId };

        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    async broadcastCustomJob(jobId, template, coords) {
        if (!coords.lat || !coords.lng) return;
        const pool = getPool();
        const [workers] = await pool.query(
            `SELECT w.user_id, t.fcm_token FROM worker_profiles w JOIN users t ON w.user_id = t.id
             WHERE w.is_online = true AND w.kyc_status = 'approved' AND t.fcm_token IS NOT NULL
             AND ST_DWithin(w.current_location, ST_MakePoint($1, $2)::geography, $3 * 1000)`,
            [coords.lng, coords.lat, this.BROADCAST_RADIUS_KM]
        );
        if (workers.length === 0) return;

        const messages = workers.map(w => ({
            token: w.fcm_token,
            notification: { title: 'New Custom Job Nearby! ✨', body: `${template.title} — ₹${template.hourly_rate}/hr` },
            data: { type: 'custom_job_available', job_id: String(jobId) }
        }));

        try {
            const app = getFirebaseApp();
            if (app && messages.length > 0) await globalThis.__firebaseAdmin.messaging(app).sendAll(messages);
        } catch (e) { console.error('[FCM] Broadcast failed:', e.message); }
    }

    async getAvailableCustomJobs(workerId, lat, lng) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT j.id as job_id, t.title, t.description, t.hourly_rate, t.photos, ST_Distance(j.job_location, ST_MakePoint($1, $2)::geography) / 1000 AS distance_km
             FROM jobs j JOIN custom_job_instances cji ON j.id = cji.job_id JOIN custom_job_templates t ON cji.template_id = t.id
             WHERE j.category = 'custom' AND j.status = 'searching' AND j.customer_id != $4
             AND ST_DWithin(j.job_location, ST_MakePoint($1, $2)::geography, $3 * 1000) ORDER BY distance_km ASC`,
            [lng, lat, this.BROADCAST_RADIUS_KM, workerId]
        );
        return rows;
    }
}
export default new CustomJobService();
