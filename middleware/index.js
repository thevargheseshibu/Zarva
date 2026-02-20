/**
 * middleware/index.js — Barrel export
 *
 * Import any middleware from a single entry point:
 *
 *   import {
 *     normalizePhone,
 *     authenticateJWT,
 *     roleGuard,
 *     generalLimiter,
 *     otpLimiter,
 *     jobCreateLimiter,
 *   } from '../middleware/index.js';
 */

export { default as normalizePhone } from './normalizePhone.js';
export { default as authenticateJWT } from './authenticateJWT.js';
export { default as roleGuard } from './roleGuard.js';
export {
    generalLimiter,
    otpLimiter,
    jobCreateLimiter,
} from './rateLimiter.js';
