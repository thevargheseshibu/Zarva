/**
 * lib/db.js - Database utilities and response handlers
 */

import { getPool } from '../config/database.js';

/**
 * Standardized response handler for route handlers
 * Supports two modes:
 * 1. handle(handler) -> returns Express middleware (recommended)
 * 2. handle(req, res, handler) -> executes immediately (compatibility mode)
 */
export function handle(reqOrHandler, res, maybeHandler) {
    const isMiddleware = typeof reqOrHandler === 'function' && !res;
    const handler = isMiddleware ? reqOrHandler : maybeHandler;

    const runner = async (req, res, next) => {
        try {
            const userId = req.user?.id;
            const pool = getPool();
            const result = await handler(userId, pool, req, res);
            
            // If handler returns a result, send it as JSON
            if (result !== undefined && result !== null) {
                return res.status(200).json({ status: 'ok', ...result });
            }
            
            // If no result, assume response was already sent manually
        } catch (error) {
            console.error('[DB Handle] Error:', error);
            
            // Check if error has status property
            const status = error.status || error.statusCode || 500;
            const message = error.message || 'Internal server error';
            const code = error.code || 'INTERNAL_ERROR';
            
            return res.status(status).json({ 
                status: 'error', 
                code, 
                message 
            });
        }
    };

    if (isMiddleware) return runner;
    // Execute immediately for compatibility with (req, res) => handle(req, res, handler)
    return runner(reqOrHandler, res, () => {});
}

/**
 * Standardized error response helper
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} status - HTTP status code
 * @param {string} code - Error code
 * @returns {Object} JSON error response
 */
export function fail(res, message, status = 400, code = 'BAD_REQUEST') {
    return res.status(status).json({ 
        status: 'error', 
        code, 
        message 
    });
}

export { getPool };