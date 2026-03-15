/**
 * src/features/inspection/types.js
 * Type definitions for the Worker-side Job Execution flow.
 *
 * @typedef {Object} LocationAddress
 * @property {string} address - Formatted address text
 * @property {number} lat - Latitude
 * @property {number} lng - Longitude
 *
 * @typedef {Object} InspectionJobData
 * @property {string|number} id - Active job ID
 * @property {string} status - e.g. 'worker_arrived', 'inspection_active', 'in_progress', 'pending_completion'
 * @property {string} category - e.g. 'plumber'
 * @property {string} [description] - Customer's problem description
 * @property {string} [location_address] - Exact job site address
 * @property {LocationAddress} customer_location
 * @property {string} customer_name - Name of the client
 * @property {string} customer_phone - Client contact number
 * @property {string[]} [image_urls] - User uploaded situation photos
 * @property {string} [inspection_otp_hash] - Secured code for arriving
 * @property {string} [start_otp_hash] - Secured code for billing start
 * @property {string} [end_otp] - Clear text completion code
 * @property {string} [inspection_started_at] - ISO string
 * @property {string} [job_started_at] - ISO string
 * @property {string} [paused_at] - ISO string if currently paused
 * @property {number} [total_paused_seconds] - Accrued unbillable time
 * @property {string} [inspection_expires_at] - Base TTL for inspection window
 * @property {string} [inspection_extended_until] - Modified TTL if extension granted
 * @property {boolean} [inspection_ext_pending] - Extension request in flight
 *
 * @typedef {Object} InspectionMaterial
 * @property {string} id - UUID
 * @property {string} name - Item description
 * @property {number} cost - Price in INR
 *
 * @typedef {Object} InspectionStoreState
 * @property {InspectionJobData|null} activeJob - The single active assignment
 * @property {string} jobStatus - Current job phase from Firebase
 * @property {boolean} loading - General API operation indicator
 * @property {string} inspectionOtp - Worker entered code to begin inspection
 * @property {string} startOtp - Worker entered code to begin billable work
 * @property {string} endOtp - The pre-fetched code needed to finish the job
 * @property {string} inspectionExtOtp - Recovered or generated code for extending inspection
 * @property {boolean} inspectExtRequested - Is an extension approval pending?
 * @property {number} chatUnread - New unread messages from customer
 * @property {InspectionMaterial[]} materials - Added billable components
 *
 * @typedef {Object} VerificationPayload
 * @property {string} otp - User supplied 4 digit code
 * @property {string} [notes] - Optional worker assessment details
 * @property {number} [estimated_duration_minutes] - Worker time quote
 * @property {number} [estimated_cost] - Worker price quote
 */

export {}; // Make it an ES module
