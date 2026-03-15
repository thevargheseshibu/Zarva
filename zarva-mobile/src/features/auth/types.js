/**
 * src/features/auth/types.js
 * Type definitions for the Validation & Authentication Feature.
 *
 * @typedef {'customer' | 'worker'} AppRole
 * @typedef {'pending' | 'submitted' | 'approved' | 'rejected'} KycStatus
 *
 * @typedef {Object} UserProfile
 * @property {string|number} id - The user's primary ID
 * @property {string} name - Full name
 * @property {string} phone - Verified phone number (e.g., "+919999999999")
 * @property {string} [email] - Optional email address
 * @property {string} [photo_url] - Optional profile picture URL
 * @property {AppRole[]} roles - Roles the user is authorized for
 * @property {AppRole|null} active_role - The single role currently in use
 * @property {KycStatus} [kyc_status] - Required for workers
 *
 * @typedef {Object} AuthState
 * @property {boolean} isAuthenticated - Whether a valid session exists
 * @property {string|null} token - JWT Bearer token
 * @property {UserProfile|null} user - The authenticated user entity
 * @property {AppRole|null} activeRole - Current focused role context
 * @property {boolean} isLoading - True during initial secure-store hydration
 *
 * @typedef {Object} VerifyPayload
 * @property {string} phone - e.g. "+919999999999"
 * @property {string} otp - 4 to 6 digit code
 * @property {string} [firebase_id_token] - Provided if SMS verification was handled via Firebase client SDK
 */

export {}; // Make it an ES module
