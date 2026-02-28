import { getPool } from '../config/database.js';
import admin from 'firebase-admin';

export class CustomJobService {
    constructor() {
        this.BROADCAST_RADIUS_KM = 25;
    }

    /**
     * Customer: Creates a new custom job template
     */
    async createTemplate(customerId, data) {
        const { title, description, photos = [], hourly_rate, fee_negotiable = false, city, state, pincode } = data;

        // Basic Validations
        if (!title || title.length > 200) throw Object.assign(new Error('Title must be 1-200 characters'), { status: 400 });
        if (!description || description.length < 30) throw Object.assign(new Error('Description must be at least 30 characters'), { status: 400 });
        if (!hourly_rate || isNaN(hourly_rate) || hourly_rate < 50 || hourly_rate > 100000) {
            throw Object.assign(new Error('Hourly rate must be a reasonable number between 50 and 100,000'), { status: 400 });
        }
        if (photos.length > 5) throw Object.assign(new Error('Maximum 5 photos allowed'), { status: 400 });

        const pool = getPool();
        const [result] = await pool.query(
            `INSERT INTO custom_job_templates (
        customer_id, title, description, photos, hourly_rate, fee_negotiable,
        city, state, pincode, approval_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending') RETURNING id`,
            [customerId, title, description, photos, hourly_rate, fee_negotiable, city, state, pincode]
        );

        const templateId = result[0].id;

        // Optionally notify admins (if FCM topic exists)
        try {
            await admin.messaging().sendToTopic('admin_custom_jobs', {
                notification: {
                    title: 'New Custom Job Pending Review',
                    body: `A new custom job "${title}" needs approval.`
                },
                data: { type: 'custom_job_review', template_id: templateId }
            });
        } catch (e) {
            console.warn('Failed to send admin FCM notification', e);
        }

        return { template_id: templateId, status: 'pending' };
    }

    /**
     * Customer: Get all their templates
     */
    async getMyTemplates(customerId) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT id, title, description, photos, hourly_rate, fee_negotiable, 
              approval_status, rejection_reason, is_active, created_at 
       FROM custom_job_templates 
       WHERE customer_id = $1 AND is_archived = FALSE
       ORDER BY created_at DESC`,
            [customerId]
        );
        return rows;
    }

    /**
     * Admin: Approve a template
     */
    async adminApproveTemplate(adminId, templateId, notes) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            const [update] = await conn.query(
                `UPDATE custom_job_templates 
         SET approval_status = 'approved', is_active = TRUE, reviewed_by = $1, reviewed_at = NOW(), admin_notes = $2
         WHERE id = $3 RETURNING customer_id`,
                [adminId, notes, templateId]
            );

            if (update.length === 0) throw Object.assign(new Error('Template not found'), { status: 404 });

            await conn.query(
                `INSERT INTO custom_job_review_log (template_id, reviewed_by, action, notes) VALUES ($1, $2, 'approved', $3)`,
                [templateId, adminId, notes]
            );

            await conn.commit();

            // Notify customer (Stub - integrate with user FCM token lookup)
            // await sendPushToUser(update[0].customer_id, 'Custom Job Approved!', 'Your custom job is ready to be posted.')

            return { success: true };
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    /**
     * Admin: Reject a template
     */
    async adminRejectTemplate(adminId, templateId, reason) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            const [update] = await conn.query(
                `UPDATE custom_job_templates 
         SET approval_status = 'rejected', is_active = FALSE, rejection_reason = $1, reviewed_by = $2, reviewed_at = NOW()
         WHERE id = $3 RETURNING customer_id`,
                [reason, adminId, templateId]
            );

            if (update.length === 0) throw Object.assign(new Error('Template not found'), { status: 404 });

            await conn.query(
                `INSERT INTO custom_job_review_log (template_id, reviewed_by, action, notes) VALUES ($1, $2, 'rejected', $3)`,
                [templateId, adminId, reason]
            );

            await conn.commit();
            return { success: true };
        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    /**
     * Customer: Post a live job from an approved template
     */
    async postJobFromTemplate(customerId, templateId, locationData) {
        const pool = getPool();
        const conn = await pool.getConnection();
        await conn.beginTransaction();

        try {
            // 1. Validate template
            const [templates] = await conn.query(
                `SELECT * FROM custom_job_templates WHERE id = $1 AND customer_id = $2 FOR UPDATE`,
                [templateId, customerId]
            );
            const template = templates[0];

            if (!template) throw Object.assign(new Error('Template not found or unauthorized'), { status: 404 });
            if (template.approval_status !== 'approved' || !template.is_active) {
                throw Object.assign(new Error('Template must be approved to post'), { status: 400 });
            }

            // Generate idempotency key for this instance
            const idempotencyKey = `custom_${templateId}_${Date.now()}`;

            // 2. Insert into main jobs table
            const [jobRes] = await conn.query(
                `INSERT INTO jobs (
            idempotency_key, customer_id, category, status,
            address, customer_address_detail, job_location, location_source,
            latitude, longitude, pincode, city, district,
            description, rate_per_hour, advance_amount, travel_charge, 
            job_source, billing_mode
        ) VALUES (
            $1, $2, 'custom', 'open',
            $3, $4, ST_GeogFromText($5), $6,
            $7, $8, $9, $10, $11,
            $12, $13, 0, 0,
            'custom', 'hourly'
        ) RETURNING id`,
                [
                    idempotencyKey, customerId,
                    locationData.address || template.city,
                    JSON.stringify(locationData.address_detail || {}),
                    locationData.location_st || `POINT(${locationData.longitude || 0} ${locationData.latitude || 0})`,
                    locationData.source || 'gps',
                    locationData.latitude, locationData.longitude,
                    template.pincode, template.city, template.state, // Dist fallback to state for now
                    template.description, template.hourly_rate
                ]
            );

            const jobId = jobRes[0].id;

            // 3. Insert into custom_job_instances
            await conn.query(
                `INSERT INTO custom_job_instances (job_id, template_id, agreed_hourly_rate)
         VALUES ($1, $2, $3)`,
                [jobId, templateId, template.hourly_rate]
            );

            await conn.commit();

            // 4. Async Broadcast to active nearby workers
            this.broadcastCustomJob(jobId, template, { lat: locationData.latitude, lng: locationData.longitude })
                .catch(console.error);

            return { job_id: jobId };

        } catch (e) {
            await conn.rollback();
            throw e;
        } finally {
            conn.release();
        }
    }

    /**
     * System: Broadcast new custom job to nearby workers
     */
    async broadcastCustomJob(jobId, template, coords) {
        if (!coords.lat || !coords.lng) return;

        const pool = getPool();
        // Find active, online workers within 25km (ignore category)
        const [workers] = await pool.query(
            `SELECT w.user_id, t.fcm_token 
       FROM worker_profiles w
       JOIN fcm_tokens t ON w.user_id = t.user_id
       WHERE w.is_online = true 
         AND w.kyc_status = 'approved'
         AND ST_DWithin(
             w.current_location,
             ST_MakePoint($1, $2)::geography,
             $3 * 1000
         )`,
            [coords.lng, coords.lat, this.BROADCAST_RADIUS_KM]
        );

        if (workers.length === 0) return;

        const messages = workers.map(w => ({
            token: w.fcm_token,
            notification: {
                title: 'New Custom Job Nearby! ✨',
                body: `${template.title} — ₹${template.hourly_rate}/hr`
            },
            data: {
                type: 'custom_job_available',
                job_id: String(jobId)
            }
        }));

        try {
            const response = await admin.messaging().sendAll(messages);
            console.log(`Successfully broadcast custom job ${jobId} to ${response.successCount} workers.`);
        } catch (e) {
            console.error('Broadcast failed:', e);
        }
    }

    /**
     * Worker: Feed logic for available custom jobs nearby
     */
    async getAvailableCustomJobs(workerId, lat, lng) {
        const pool = getPool();
        const [rows] = await pool.query(
            `SELECT j.id as job_id, t.title, t.description, t.hourly_rate, t.photos,
              ST_Distance(j.job_location, ST_MakePoint($1, $2)::geography) / 1000 AS distance_km
       FROM jobs j
       JOIN custom_job_instances cji ON j.id = cji.job_id
       JOIN custom_job_templates t ON cji.template_id = t.id
       WHERE j.job_source = 'custom' AND j.status = 'open'
         AND j.customer_id != $4
         AND ST_DWithin(j.job_location, ST_MakePoint($1, $2)::geography, $3 * 1000)
       ORDER BY distance_km ASC`,
            [lng, lat, this.BROADCAST_RADIUS_KM, workerId]
        );
        return rows;
    }
}

export default new CustomJobService();
