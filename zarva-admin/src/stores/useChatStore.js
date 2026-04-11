/**
 * useChatStore.js — Zustand + Socket.io state manager for dispute chat.
 *
 * Actions:
 *   connect(token)        — Establish socket connection with JWT
 *   joinRoom(disputeId)   — Join a dispute room, receive history
 *   sendMessage(payload)  — Send message to current room
 *   disconnect()          — Clean disconnect
 */

import { create } from 'zustand';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';

const useChatStore = create((set, get) => ({
  socket: null,
  connected: false,
  currentDisputeId: null,
  messages: [],
  typingUser: null,
  error: null,

  // ── Connect to the Socket.io dispute hub ─────────────────
  connect: (token) => {
    const existing = get().socket;
    if (existing?.connected) return; // already connected

    const socket = io(SOCKET_URL, {
      path: '/ws/disputes',
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    });

    socket.on('connect', () => {
      console.log('[ChatStore] Socket connected:', socket.id);
      set({ connected: true, error: null });
    });

    socket.on('disconnect', (reason) => {
      console.log('[ChatStore] Socket disconnected:', reason);
      set({ connected: false });
    });

    socket.on('connect_error', (err) => {
      console.error('[ChatStore] Connection error:', err.message);
      set({ error: err.message, connected: false });
    });

    // ── Incoming: full dispute history on room join ──────────
    socket.on('dispute_history', ({ messages }) => {
      set({ messages: messages || [] });
    });

    // ── Incoming: new message ───────────────────────────────
    socket.on('new_message', (message) => {
      set(state => ({
        messages: [...state.messages, message],
        typingUser: null, // clear typing on new message
      }));
    });

    // ── Incoming: typing indicator ──────────────────────────
    socket.on('user_typing', ({ name, role }) => {
      set({ typingUser: { name, role } });
      // Auto-clear after 3s
      setTimeout(() => {
        set(state => {
          if (state.typingUser?.name === name) return { typingUser: null };
          return {};
        });
      }, 3000);
    });

    // ── Incoming: error ─────────────────────────────────────
    socket.on('error', ({ message }) => {
      console.error('[ChatStore] Server error:', message);
      set({ error: message });
    });

    set({ socket });
  },

  // ── Join a dispute room ──────────────────────────────────
  joinRoom: (disputeId) => {
    const { socket } = get();
    if (!socket?.connected) {
      console.warn('[ChatStore] Cannot join room — not connected');
      return;
    }

    // Leave previous room implicitly (server handles this)
    set({ currentDisputeId: disputeId, messages: [], typingUser: null });
    socket.emit('join_dispute_room', { disputeId });
  },

  // ── Send a message ───────────────────────────────────────
  sendMessage: ({ content, attachmentUrl, isInternalNote }) => {
    const { socket } = get();
    if (!socket?.connected) {
      console.warn('[ChatStore] Cannot send — not connected');
      return;
    }

    socket.emit('send_message', {
      content,
      attachmentUrl: attachmentUrl || null,
      isInternalNote: isInternalNote || false,
    });
  },

  // ── Send typing indicator ────────────────────────────────
  sendTyping: () => {
    const { socket } = get();
    if (socket?.connected) {
      socket.emit('typing');
    }
  },

  // ── Disconnect ───────────────────────────────────────────
  disconnect: () => {
    const { socket } = get();
    if (socket) {
      socket.disconnect();
      set({ socket: null, connected: false, currentDisputeId: null, messages: [] });
    }
  },
}));

export default useChatStore;
