/**
 * src/features/customer/types.js
 * Type definitions for the Customer domain (Profile, Support, Addresses).
 *
 * @typedef {Object} SavedAddress
 * @property {string|number} id
 * @property {string} label - e.g. 'Home', 'Office'
 * @property {string} address - Full text
 * @property {number} latitude
 * @property {number} longitude
 * @property {boolean} [is_default]
 *
 * @typedef {Object} SupportTicket
 * @property {string|number} id
 * @property {string} subject - Short title of issue
 * @property {string} status - 'open'|'in_progress'|'resolved'
 * @property {string} created_at - ISO timestamp
 * @property {string} last_message_at - ISO timestamp
 *
 * @typedef {Object} ChatMessage
 * @property {string} id - Firebase push key
 * @property {string|number} sender_id
 * @property {'customer'|'worker'|'support'} sender_role
 * @property {string} text - Message payload
 * @property {number} timestamp - Epoch JS Time (ms)
 * @property {boolean} read - Delivery status
 *
 * @typedef {Object} CustomerPreferences
 * @property {boolean} notificationsEnabled
 * @property {string} locale - e.g. 'en', 'hi'
 *
 * @typedef {Object} CustomerStoreState
 * @property {Object|null} profile - Customer subset of global user object
 * @property {boolean} isLoadingProfile
 * @property {SavedAddress[]} addresses
 * @property {SavedAddress|null} selectedAddress - Context for job creation drop-down
 * @property {SupportTicket[]} openTickets
 * @property {Record<string, ChatMessage[]>} supportChatByTicket - Local cache keyed by ticket ID
 * @property {CustomerPreferences} preferences
 */

export {}; // Make it an ES module
