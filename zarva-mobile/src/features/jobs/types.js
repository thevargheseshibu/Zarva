/**
 * src/features/jobs/types.js
 * Type definitions for Customer Job Booking & Tracking.
 *
 * @typedef {'normal' | 'emergency'} JobUrgency
 *
 * @typedef {Object} JobDraft
 * @property {string|null} category - Service type ID (e.g. 'electrician')
 * @property {string|null} categoryIcon - Unicode or asset identifier
 * @property {string} description - Problem details
 * @property {string} address - Service location text
 * @property {number|null} latitude
 * @property {number|null} longitude
 * @property {string[]} images - Local device URIs
 * @property {string[]} imageUrls - Uploaded cloud URLs
 * @property {JobUrgency} urgency
 * @property {string|null} scheduled_at - ISO string or null for ASAP
 *
 * @typedef {Object} AssignedWorkerInfo
 * @property {string|number} id
 * @property {string} name
 * @property {number} rating
 * @property {string} [photo]
 * @property {number} lat
 * @property {number} lng
 * @property {string} phone
 *
 * @typedef {Object} CustomerJobStoreState
 * @property {string|null} activeJobId - Current live assignment ID
 * @property {string|null} searchPhase - 'searching'|'assigned'|'in_progress' etc.
 * @property {AssignedWorkerInfo|null} assignedWorker - Display data for matched pro
 * @property {boolean} isListening - Realtime watcher flag
 * @property {JobDraft} postDraft - Creation form data buffer
 * @property {string[]} recentJobIds - Array of tracked historic job references
 */

export {}; // Make it an ES module
