/**
 * src/features/customer/hooks/useChatMessages.js
 * Firebase Realtime Database listener for the in-job chat between
 * customer and worker (and optionally customer and support).
 *
 * Listens to:
 *   active_jobs/{jobId}/messages → ordered list of chat messages
 *
 * On mount:
 *   - Attaches onValue listener, hydrates message list
 *   - Resets the unread badge for this user's role by writing 0
 *
 * On unmount:
 *   - Detaches listeners cleanly
 *
 * Returns:
 *   { messages, isLoading, sendMessage }
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, onValue, off, push, set, serverTimestamp } from 'firebase/database';
import { db } from '@infra/firebase/app';
import apiClient from '@infra/api/client';

/**
 * @param {string|number} jobId  - The active job ID
 * @param {'customer' | 'worker' | 'support'} userRole - Who is reading the chat
 * @param {string|number} userId - The current user's ID (for sender tagging)
 */
export function useChatMessages(jobId, userRole = 'customer', userId) {
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const hasHydrated = useRef(false);

  useEffect(() => {
    if (!jobId) return;

    setIsLoading(true);
    hasHydrated.current = false;

    const messagesRef = ref(db, `active_jobs/${jobId}/messages`);

    const listener = onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setMessages([]);
        setIsLoading(false);
        hasHydrated.current = true;
        return;
      }

      // Firebase returns an object keyed by push-id — convert to sorted array
      const messageList = Object.entries(data)
        .map(([key, value]) => ({
          id: key,
          ...value,
        }))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      setMessages(messageList);
      setIsLoading(false);

      // Reset unread badge for this role after first hydration
      if (!hasHydrated.current) {
        hasHydrated.current = true;
        const unreadRef = ref(db, `active_jobs/${jobId}/chat_unread/${userRole}`);
        set(unreadRef, 0).catch(() => {});
      }
    });

    return () => {
      off(messagesRef, 'value', listener);
    };
  }, [jobId, userRole]);

  /**
   * Send a message to the active job's chat.
   * @param {string} text - The message text
   * @returns {Promise<boolean>} true on success
   */
  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text?.trim();
      if (!trimmed || !jobId || isSending) return false;

      setIsSending(true);
      try {
        const messagesRef = ref(db, `active_jobs/${jobId}/messages`);
        const newMessageRef = push(messagesRef);
        await set(newMessageRef, {
          sender_id: userId,
          sender_role: userRole,
          text: trimmed,
          timestamp: Date.now(), // client time (Firebase serverTimestamp unavailable in push)
          read: false,
        });

        // Increment the OTHER party's unread badge
        const otherRole = userRole === 'customer' ? 'worker' : 'customer';
        const otherUnreadRef = ref(db, `active_jobs/${jobId}/chat_unread/${otherRole}`);
        const currentMessages = messages.filter((m) => m.sender_role === otherRole);
        // Use server REST API to increment atomically (avoids transaction race)
        apiClient
          .post(`/api/jobs/${jobId}/chat/mark-unread`, { role: otherRole })
          .catch(() => {}); // best-effort

        return true;
      } catch (err) {
        console.error('[useChatMessages] sendMessage failed:', err?.message);
        return false;
      } finally {
        setIsSending(false);
      }
    },
    [jobId, userId, userRole, isSending, messages]
  );

  /**
   * Mark all messages as read for this role (called on screen focus).
   */
  const markAllRead = useCallback(() => {
    if (!jobId) return;
    const unreadRef = ref(db, `active_jobs/${jobId}/chat_unread/${userRole}`);
    set(unreadRef, 0).catch(() => {});
  }, [jobId, userRole]);

  return {
    messages,
    isLoading,
    isSending,
    sendMessage,
    markAllRead,
    messageCount: messages.length,
  };
}
