/**
 * src/features/notifications/types.js
 * Type definitions for Push Notifications and Alerts.
 *
 * @typedef {'NEW_JOB_ALERT' | 'job_accepted' | 'job_started' | 'job_completed' | 'chat_message' | 'ticket_update'} FcmMessageType
 *
 * @typedef {Object} FcmPayloadData
 * @property {FcmMessageType} type - The routing discriminator
 * @property {string} [jobId] - Contextual job ID for navigation
 * @property {string} [ticketId] - Contextual support ticket ID
 * @property {string} [alertId] - Used to clear specific worker alerts
 * @property {string} [category] - Category of the job (e.g., 'plumber')
 * @property {string} [expires_at] - ISO string for alert TTL
 * @property {string} [est_distance] - Human readable distance (e.g., "2.5 km")
 * @property {string} [sender_id] - For chat messages
 *
 * @typedef {Object} PendingJobAlert
 * @property {string|number} job_id - The job being offered
 * @property {string} category - e.g. 'electrician'
 * @property {string} address - Formatted address string
 * @property {string} status - Job status at time of ping
 * @property {string} urgency - 'normal' | 'emergency'
 * @property {string} expires_at - ISO timestamp when the alert is retracted
 * @property {string} ping_id - Internal tracking ID for acceptance
 * @property {number} lat - Job latitude
 * @property {number} lng - Job longitude
 *
 * @typedef {Object} NotificationStoreState
 * @property {Array} history - Log of received notifications
 * @property {number} unreadCount - Global badge count
 * @property {boolean} permissionGranted - OS-level notification permission
 * @property {string|null} fcmToken - The device routing token
 */

export {}; // Make it an ES module
