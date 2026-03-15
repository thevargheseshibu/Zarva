/**
 * src/features/worker/types.js
 * Type definitions for the Worker domain (Dashboard, Stats, Onboarding).
 *
 * @typedef {Object} WorkerStats
 * @property {number} today - Jobs completed today
 * @property {number} week - Jobs completed this week
 * @property {number} total_jobs - Lifetime jobs
 * @property {number} earnings_today - Earnings in INR today
 * @property {number} earnings_week - Earnings in INR this week
 * @property {number} earnings_month - Earnings in INR this month
 *
 * @typedef {Object} SkillExperience
 * @property {string|number} skill_id
 * @property {number} years_experience
 *
 * @typedef {Object} OnboardingPayload
 * @property {Object} personal
 * @property {string} personal.fullName
 * @property {string} personal.dateOfBirth
 * @property {string} personal.emergencyContact
 * @property {string} personal.emergencyPhone
 * @property {string} personal.aadhaarNumber
 * @property {SkillExperience[]} skills
 * @property {Object} banking
 * @property {string} banking.accountHolderName
 * @property {string} banking.bankName
 * @property {string} banking.accountNumber
 * @property {string} banking.ifscCode
 * @property {string} banking.upiId
 * @property {Object} service_area
 * @property {number} service_area.latitude
 * @property {number} service_area.longitude
 * @property {number} service_area.radius_km - Must be >= 15
 * @property {boolean} agreed_to_terms
 *
 * @typedef {Object} WorkerStoreState
 * @property {boolean} isOnline - User-toggled online/offline state
 * @property {boolean} isAvailable - API-driven matching eligibility state
 * @property {Object|null} activeJob - Fast-access reference to the current assignment
 * @property {Object|null} locationOverride - Dev/debug location pinning
 */

export {}; // Make it an ES module
