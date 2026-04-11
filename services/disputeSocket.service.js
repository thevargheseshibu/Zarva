/**
 * services/disputeSocket.service.js
 *
 * Real-Time Socket.io Hub for the Dispute Management System.
 *
 * Architecture:
 *   - JWT authentication via handshake middleware
 *   - Room-based isolation: one room per dispute_id
 *   - Internal notes are only broadcast to admin sockets
 *   - Every message is persisted to PostgreSQL BEFORE emission
 *
 * Usage from server.js:
 *   import { initDisputeSocket } from './services/disputeSocket.service.js';
 *   const httpServer = http.createServer(app);
 *   initDisputeSocket(httpServer);
 */

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { getPool } from '../config/database.js';

let io = null;

/**
 * Attach Socket.io to the HTTP server.
 * @param {import('http').Server} httpServer
 */
export function initDisputeSocket(httpServer) {
    io = new Server(httpServer, {
        cors: {
            origin: '*',              // tighten in production
            methods: ['GET', 'POST'],
        },
        path: '/ws/disputes',         // dedicated namespace path
    });

    // ── JWT Authentication Middleware ────────────────────────────────────────
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token
            || socket.handshake.headers?.authorization?.replace('Bearer ', '');

        if (!token) {
            return next(new Error('Authentication required'));
        }

        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.user = {
                id:     decoded.id || decoded.userId,
                role:   decoded.active_role || decoded.role || 'customer',
                roles:  decoded.roles || [],
                name:   decoded.name || 'Unknown',
            };
            next();
        } catch (err) {
            console.warn('[DisputeSocket] JWT verification failed:', err.message);
            return next(new Error('Invalid or expired token'));
        }
    });

    // ── Connection Handler ──────────────────────────────────────────────────
    io.on('connection', (socket) => {
        const user = socket.user;
        console.log(`[DisputeSocket] Connected: User #${user.id} (${user.role})`);

        // ── Join a dispute room ─────────────────────────────────────────────
        socket.on('join_dispute_room', async ({ disputeId }) => {
            if (!disputeId) return socket.emit('error', { message: 'disputeId required' });

            try {
                // Verify the user has permission to access this dispute
                const pool = getPool();
                const [jobs] = await pool.query(`
                    SELECT j.customer_id, j.worker_id, j.id AS job_id
                    FROM jobs j
                    WHERE j.id = $1
                      AND (j.status = 'disputed' OR j.dispute_status IS NOT NULL)
                `, [disputeId]);

                const isAdmin = user.role === 'admin' || user.role === 'superadmin'
                    || (user.roles && (user.roles.includes('admin') || user.roles.includes('superadmin')));

                if (!isAdmin && jobs.length > 0) {
                    const job = jobs[0];
                    if (job.customer_id != user.id && job.worker_id != user.id) {
                        return socket.emit('error', { message: 'Access denied to this dispute' });
                    }
                }

                // Join the room
                const roomName = `dispute_${disputeId}`;
                socket.join(roomName);
                socket.disputeRoom = roomName;
                socket.disputeId = disputeId;

                console.log(`[DisputeSocket] User #${user.id} joined ${roomName}`);

                // Load recent messages for this dispute
                const [messages] = await pool.query(`
                    SELECT dm.*, u.name AS sender_name
                    FROM dispute_messages dm
                    LEFT JOIN users u ON dm.sender_id = u.id
                    WHERE dm.dispute_id = $1
                    ORDER BY dm.created_at ASC
                    LIMIT 100
                `, [disputeId]);

                // If user is NOT admin, filter out internal notes
                const filteredMessages = isAdmin
                    ? messages
                    : messages.filter(m => !m.is_internal_note);

                socket.emit('dispute_history', { messages: filteredMessages });
            } catch (err) {
                console.error('[DisputeSocket] join_dispute_room error:', err);
                socket.emit('error', { message: 'Failed to join dispute room' });
            }
        });

        // ── Send a message ──────────────────────────────────────────────────
        socket.on('send_message', async ({ content, attachmentUrl, isInternalNote }) => {
            if (!socket.disputeId) {
                return socket.emit('error', { message: 'You must join a dispute room first' });
            }
            if (!content && !attachmentUrl) {
                return socket.emit('error', { message: 'Message content or attachment required' });
            }

            const disputeId = socket.disputeId;
            const isAdmin = user.role === 'admin' || user.role === 'superadmin'
                || (user.roles && (user.roles.includes('admin') || user.roles.includes('superadmin')));

            // Only admins can send internal notes
            const internalNote = isAdmin && isInternalNote === true;

            try {
                const pool = getPool();

                // ── PERSISTENCE FIRST: save to DB before emitting ───────────
                const [inserted] = await pool.query(`
                    INSERT INTO dispute_messages
                        (dispute_id, sender_id, sender_role, content, attachment_url, is_internal_note)
                    VALUES ($1, $2, $3, $4, $5, $6)
                    RETURNING *
                `, [
                    disputeId,
                    user.id,
                    user.role,
                    content || null,
                    attachmentUrl || null,
                    internalNote,
                ]);

                const message = {
                    ...inserted[0],
                    sender_name: user.name,
                };

                // ── SMART EMISSION ──────────────────────────────────────────
                const roomName = `dispute_${disputeId}`;

                if (internalNote) {
                    // Internal notes: only emit to admin sockets in the room
                    const socketsInRoom = await io.in(roomName).fetchSockets();
                    for (const s of socketsInRoom) {
                        const sRole = s.user?.role;
                        const sRoles = s.user?.roles || [];
                        const sIsAdmin = sRole === 'admin' || sRole === 'superadmin'
                            || sRoles.includes('admin') || sRoles.includes('superadmin');

                        if (sIsAdmin) {
                            s.emit('new_message', message);
                        }
                    }
                } else {
                    // Public messages: broadcast to everyone in the room
                    io.to(roomName).emit('new_message', message);
                }

                console.log(`[DisputeSocket] Message saved & emitted | Dispute #${disputeId} | Internal: ${internalNote}`);
            } catch (err) {
                console.error('[DisputeSocket] send_message error:', err);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // ── Typing indicator ────────────────────────────────────────────────
        socket.on('typing', () => {
            if (socket.disputeRoom) {
                socket.to(socket.disputeRoom).emit('user_typing', {
                    userId: user.id,
                    name:   user.name,
                    role:   user.role,
                });
            }
        });

        // ── Disconnect ──────────────────────────────────────────────────────
        socket.on('disconnect', () => {
            console.log(`[DisputeSocket] Disconnected: User #${user.id}`);
        });
    });

    console.log('[DisputeSocket] Socket.io hub initialized on /ws/disputes');
    return io;
}

/**
 * Get the io instance (for use in REST routes if needed).
 */
export function getIO() {
    return io;
}
