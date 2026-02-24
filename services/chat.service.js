/**
 * services/chatService.js
 * 
 * Business logic for the Job-Tied Chat System.
 */
import { getPool } from '../config/database.js';
import configLoader from '../config/loader.js';
import { updateJobChatUnread, updateJobLastMessage, updateJobTyping } from './firebase.service.js';
import * as fcmService from './fcmService.js';

export async function getMessages(jobId, userId, beforeMessageId, limit = 50) {
    const pool = getPool();

    // Secure the read: Ensure user is part of this job
    const [jobs] = await pool.query('SELECT customer_id, worker_id, chat_enabled FROM jobs WHERE id = ?', [jobId]);
    if (jobs.length === 0) {
        throw Object.assign(new Error('Job not found'), { status: 404 });
    }
    const job = jobs[0];
    console.log(`[ChatService] JobState Check | JobID:${jobId} | UserID:${userId} | JobCustomer:${job.customer_id} | JobWorker:${job.worker_id} | ChatEnabled:${job.chat_enabled}`);

    if (job.customer_id != userId && job.worker_id != userId) {
        throw Object.assign(new Error('Access denied'), { status: 403, code: 'CHAT_ACCESS_DENIED' });
    }

    let query = `
        SELECT 
            m.id, m.job_id, m.sender_id, m.sender_role, m.message_type, 
            CASE WHEN m.is_deleted THEN NULL ELSE m.content END as content, 
            CASE WHEN m.is_deleted THEN NULL ELSE m.s3_key END as s3_key,
            m.client_message_id, m.created_at, m.is_deleted,
            u.name as sender_name
        FROM job_messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.job_id = ?
    `;
    const params = [jobId];

    if (beforeMessageId) {
        query += ' AND m.id < ?';
        params.push(beforeMessageId);
    }

    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(limit);

    const [messages] = await pool.query(query, params);
    return messages;
}

export async function sendMessage({ jobId, senderId, senderRole, messageType, content, s3Key, clientMessageId }) {
    const pool = getPool();
    const chatConfig = configLoader.get('features')?.chat || { enabled: true, max_message_length: 500, image_messages_enabled: true };

    if (!chatConfig.enabled) {
        throw Object.assign(new Error('Chat feature is globally disabled'), { status: 403, code: 'CHAT_DISABLED' });
    }

    if (messageType === 'text' && (!content || content.length > chatConfig.max_message_length)) {
        throw Object.assign(new Error(`Message exceeds maximum length of ${chatConfig.max_message_length}`), { status: 400 });
    }
    if (messageType === 'image' && !chatConfig.image_messages_enabled) {
        throw Object.assign(new Error('Image messages are disabled'), { status: 400 });
    }

    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
        // Validate job state
        const [jobs] = await conn.query('SELECT customer_id, worker_id, chat_enabled FROM jobs WHERE id = ? FOR UPDATE', [jobId]);
        if (jobs.length === 0) throw Object.assign(new Error('Job not found'), { status: 404 });

        const job = jobs[0];
        if (job.customer_id != senderId && job.worker_id != senderId) {
            throw Object.assign(new Error('Access denied'), { status: 403, code: 'CHAT_ACCESS_DENIED' });
        }
        if (!job.chat_enabled) {
            throw Object.assign(new Error('Chat is currently locked for this job'), { status: 403, code: 'CHAT_DISABLED' });
        }

        const recipientId = senderRole === 'customer' ? job.worker_id : job.customer_id;

        // Idempotency Check
        const [existing] = await conn.query('SELECT * FROM job_messages WHERE job_id = ? AND client_message_id = ?', [jobId, clientMessageId]);
        if (existing.length > 0) {
            await conn.commit();
            const msg = existing[0];
            const [u] = await pool.query('SELECT name FROM users WHERE id = ?', [msg.sender_id]);
            msg.sender_name = u[0].name;
            return msg; // Already saved
        }

        // Insert message
        const [res] = await conn.query(
            `INSERT INTO job_messages (job_id, sender_id, sender_role, message_type, content, s3_key, client_message_id) 
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [jobId, senderId, senderRole, messageType, content || null, s3Key || null, clientMessageId]
        );

        const newMessageId = res.insertId;

        // Update Job Aggregates
        const updateField = senderRole === 'customer' ? 'worker_unread_count' : 'customer_unread_count';
        await conn.query(
            `UPDATE jobs SET last_message_at = NOW(), ${updateField} = ${updateField} + 1 WHERE id = ?`,
            [jobId]
        );

        // Fetch new state for Firebase sync
        const [updatedJobs] = await conn.query('SELECT customer_unread_count, worker_unread_count FROM jobs WHERE id = ?', [jobId]);
        const newUnreadCount = senderRole === 'customer' ? updatedJobs[0].worker_unread_count : updatedJobs[0].customer_unread_count;

        // Fetch sender name
        const [senders] = await conn.query('SELECT name FROM users WHERE id = ?', [senderId]);
        const senderName = senders[0].name;

        await conn.commit();

        // 1. Fire FCM Notification
        const preview = messageType === 'image' ? 'Sent a photo' : content;
        await fcmService.sendChatNotification(jobId, recipientId, senderName, preview, messageType);

        // 2. Sync to Firebase
        await updateJobChatUnread(jobId, recipientId, newUnreadCount).catch(() => { });
        await updateJobLastMessage(jobId, {
            content: preview,
            sender_id: senderId,
            sender_name: senderName,
            sent_at: Date.now(),
            message_type: messageType
        }).catch(() => { });

        // Fetch back full message for response
        const [msgs] = await pool.query(`
            SELECT m.*, u.name as sender_name 
            FROM job_messages m JOIN users u ON m.sender_id = u.id 
            WHERE m.id = ?
        `, [newMessageId]);

        return msgs[0];
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

export async function deleteMessage(jobId, messageId, requesterId) {
    const pool = getPool();
    const chatConfig = configLoader.get('features')?.chat || { delete_window_seconds: 60 };

    const [msgs] = await pool.query('SELECT sender_id, created_at, is_deleted FROM job_messages WHERE id = ? AND job_id = ?', [messageId, jobId]);
    if (msgs.length === 0) throw Object.assign(new Error('Message not found'), { status: 404 });
    const msg = msgs[0];

    if (msg.sender_id != requesterId) {
        throw Object.assign(new Error('Cannot delete another users message'), { status: 403 });
    }
    if (msg.is_deleted) return; // already deleted

    const secondsSinceSent = (Date.now() - new Date(msg.created_at).getTime()) / 1000;
    if (secondsSinceSent > chatConfig.delete_window_seconds) {
        throw Object.assign(new Error(`Messages can only be deleted within ${chatConfig.delete_window_seconds} seconds`), { status: 403, code: 'DELETE_WINDOW_EXPIRED' });
    }

    await pool.query(
        'UPDATE job_messages SET is_deleted = 1, content = NULL, s3_key = NULL, deleted_at = NOW() WHERE id = ?',
        [messageId]
    );

    // Note: If it was the *last message*, we technically could update Firebase `last_message` to show "Message deleted" 
    // but fetching the previous message adds DB overhead. For now, mobile client handles deleted messages cleanly.
}

export async function markRead(jobId, userId, userRole) {
    const pool = getPool();

    // Reset MySQL unread counts
    const updateField = userRole === 'customer' ? 'customer_unread_count' : 'worker_unread_count';
    const otherRole = userRole === 'customer' ? 'worker' : 'customer';

    const conn = await pool.getConnection();
    await conn.beginTransaction();
    try {
        await conn.query(`UPDATE jobs SET ${updateField} = 0 WHERE id = ?`, [jobId]);

        // Mark all other party's messages as read
        await conn.query(`
            UPDATE job_messages SET read_at = NOW() 
            WHERE job_id = ? AND sender_role = ? AND read_at IS NULL
        `, [jobId, otherRole]);

        await conn.commit();

        // Clear Firebase Unread
        await updateJobChatUnread(jobId, userId, 0).catch(() => { });
    } catch (e) {
        await conn.rollback();
        throw e;
    } finally {
        conn.release();
    }
}

export async function sendTypingIndicator(jobId, userId) {
    // Fire and forget to Firebase (auto expirations handle the cleanup)
    await updateJobTyping(jobId, userId).catch(() => { });
}
