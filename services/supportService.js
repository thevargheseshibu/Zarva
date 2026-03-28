import { getPool } from '../config/database.js';
import * as notificationService from './notification.service.js';
import * as firebaseService from './firebase.service.js';
import crypto from 'crypto';

class SupportService {

  // ─── Create Ticket (General or Job-specific) ───────────────────
  async createTicket(data) {
    const { user_id, user_role, ticket_type, job_id, category, description } = data;

    const pool = getPool();
    // Validate job ownership if job_id provided
    if (job_id && ticket_type !== 'general_chat') {
      const [job] = await pool.query(
        `SELECT * FROM jobs WHERE id = $1 AND (customer_id = $2 OR worker_id = $2)`,
        [job_id, user_id]
      );
      if (!job[0]) throw new Error('Job not found or unauthorized');

      // Check: Already has an open ticket for this job?
      const [existing] = await pool.query(
        `SELECT id FROM support_tickets
         WHERE job_id = $1 AND raised_by_user_id = $2 AND status NOT IN ('resolved', 'closed')`,
        [job_id, user_id]
      );
      if (existing.length > 0) {
        throw new Error('You already have an open ticket for this job');
      }
    }

    // If formal dispute: check concurrency lock
    if (ticket_type === 'job_dispute') {
      const [slot] = await pool.query(
        `SELECT is_locked FROM user_job_slots WHERE user_id = $1`,
        [user_id]
      );
      if (slot[0]?.is_locked) {
        throw new Error(
          'You have 2 active disputes. Please resolve at least one before raising another.'
        );
      }
    }

    // Get category config
    let priority = 'medium';
    if (category) {
      const [cat] = await pool.query(
        `SELECT * FROM dispute_categories WHERE category_key = $1`, [category]
      );
      priority = cat[0]?.priority_default || 'medium';
    }

    // Generate ticket number
    const [count] = await pool.query(`SELECT COUNT(*) as count FROM support_tickets`);
    const ticketNumber = `TKT-${new Date().getFullYear()}-${String(parseInt(count[0].count) + 1).padStart(5, '0')}`;

    // Determine if this affects job completion
    let affects_completion = false;
    if (job_id && ticket_type === 'job_dispute') {
      const [job] = await pool.query(`SELECT status FROM jobs WHERE id = $1`, [job_id]);
      affects_completion = job[0]?.status === 'awaiting_completion_verification';
    }

    // Create ticket
    const [ticket] = await pool.query(`
      INSERT INTO support_tickets(
      raised_by_user_id, raised_by_role, ticket_type, job_id,
      dispute_category, is_formal_dispute, status, priority,
      affects_job_completion, ticket_number
    )
    VALUES($1, $2, $3, $4, $5, $6, 'open', $7, $8, $9)
    RETURNING *
      `, [
      user_id, user_role, ticket_type, job_id || null,
      category || null, ticket_type === 'job_dispute',
      priority, affects_completion, ticketNumber
    ]);

    const ticketId = ticket[0].id;

    // Add first message
    if (description) {
      await this.addMessage(ticketId, user_id, user_role, description);
    }

    // If formal job dispute: update job and concurrency
    if (ticket_type === 'job_dispute' && job_id) {
      await pool.query(`
        UPDATE jobs SET dispute_status = 'disputed', active_ticket_id = $1 WHERE id = $2
      `, [ticketId, job_id]);

      await this.updateConcurrencySlot(user_id, 'dispute_added');
    }

    // Notify admin
    // await notificationService.notifyAdmin(ticketId, ticket_type, priority);

    return { ticket_id: ticketId, ticket_number: ticketNumber };
  }


  // ─── Concurrency Slot Management ───────────────────────────────
  async updateConcurrencySlot(userId, action) {
    const pool = getPool();
    if (action === 'dispute_added') {
      await pool.query(`
        INSERT INTO user_job_slots(user_id, disputed_job_count)
    VALUES($1, 1)
        ON CONFLICT(user_id) DO UPDATE
        SET disputed_job_count = user_job_slots.disputed_job_count + 1,
      is_locked = (user_job_slots.disputed_job_count + 1) >= 2,
      updated_at = NOW()
        `, [userId]);
    }

    if (action === 'dispute_resolved') {
      await pool.query(`
        UPDATE user_job_slots
        SET disputed_job_count = GREATEST(disputed_job_count - 1, 0),
      is_locked = CASE WHEN disputed_job_count - 1 >= 2 THEN TRUE ELSE FALSE END,
        updated_at = NOW()
        WHERE user_id = $1
      `, [userId]);
    }

    if (action === 'job_accepted') {
      await pool.query(`
        INSERT INTO user_job_slots(user_id, active_job_count)
        VALUES($1, 1)
        ON CONFLICT(user_id) DO UPDATE SET
            active_job_count = user_job_slots.active_job_count + 1,
            updated_at = NOW()
      `, [userId]);
    }

    if (action === 'job_finished') {
      await pool.query(`
        UPDATE user_job_slots
        SET active_job_count = GREATEST(active_job_count - 1, 0),
            updated_at = NOW()
        WHERE user_id = $1
      `, [userId]);
    }
  }


  // ─── Check if user can take a new job ──────────────────────────
  async canUserTakeNewJob(userId) {
    const pool = getPool();
    const [slot] = await pool.query(
      `SELECT active_job_count, disputed_job_count, is_locked FROM user_job_slots WHERE user_id = $1`,
      [userId]
    );

    if (!slot[0]) return { can_take: true };

    const { active_job_count, disputed_job_count, is_locked } = slot[0];

    // Priority 1: High dispute lock
    if (is_locked) {
      return {
        can_take: false,
        reason: 'Your account is locked due to unresolved disputes. Resolve at least one to continue.',
        disputed_count: disputed_job_count
      };
    }

    // Priority 2: Concurrent Job Cap (Max 3)
    const MAX_CONCURRENT = 3;
    if (active_job_count >= MAX_CONCURRENT) {
      return { 
        can_take: false, 
        reason: `Maximum concurrent job limit reached (${MAX_CONCURRENT}). Complete a job to accept more.` 
      };
    }

    // Optional rule: If has a dispute, can only take 1 other job?
    // Based on user request, we are primarily moving to a 3-job system.
    // If they have 1 dispute, they can have 2 other active jobs (total 3 slots occupied).
    if (disputed_job_count >= 1 && (active_job_count + disputed_job_count) >= MAX_CONCURRENT) {
        return { 
            can_take: false, 
            reason: 'You have an active dispute. You can only maintain 2 other active jobs.' 
        };
    }

    return { can_take: true };
  }


  // ─── Add Message ───────────────────────────────────────────────
  async addMessage(ticketId, senderId, senderRole, text, attachments = []) {
    const pool = getPool();
    const [msg] = await pool.query(`
      INSERT INTO ticket_messages(ticket_id, sender_id, sender_role, message_text, attachment_urls)
    VALUES($1, $2, $3, $4, $5)
    RETURNING *
      `, [ticketId, senderId, senderRole, text, attachments]);

    // Update last_activity_at
    await pool.query(
      `UPDATE support_tickets SET last_activity_at = NOW() WHERE id = $1`, [ticketId]
    );

    // Sync to Firebase for real-time
    await firebaseService.pushTicketMessage(ticketId, msg[0]);

    // Send push notification to the customer/worker if Admin replied
    if (senderRole === 'admin') {
      const pool = getPool();
      const [ticket] = await pool.query(`SELECT raised_by_user_id, ticket_number FROM support_tickets WHERE id = $1`, [ticketId]);
      if (ticket[0]) {
        await notificationService.notifyTicketMessage(ticket[0].raised_by_user_id, ticket[0].ticket_number, ticketId);
      }
    }

    return msg[0];
  }


  // ─── Admin Resolve ─────────────────────────────────────────────
  async resolveTicket(ticketId, adminId, resolution) {
    const pool = getPool();
    const [ticket] = await pool.query(
      `SELECT * FROM support_tickets WHERE id = $1`, [ticketId]
    );
    const t = ticket[0];

    await pool.query(`
      UPDATE support_tickets
      SET status = 'resolved', resolved_by = $1, resolved_at = NOW(),
      resolution_type = $2, resolution_notes = $3, resolution_amount = $4
      WHERE id = $5
      `, [adminId, resolution.type, resolution.notes, resolution.amount || null, ticketId]);

    // If was a job dispute: clear dispute status from job
    if (t.job_id && t.is_formal_dispute) {
      await pool.query(
        `UPDATE jobs SET dispute_status = NULL, active_ticket_id = NULL WHERE id = $1`,
        [t.job_id]
      );

      // Update concurrency slot for the user
      await this.updateConcurrencySlot(t.raised_by_user_id, 'dispute_resolved');
    }

    // Notify user
    await notificationService.notifyTicketResolved(t.raised_by_user_id, t.ticket_number, ticketId);
  }
}

export default new SupportService();
