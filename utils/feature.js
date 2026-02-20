/**
 * Feature flag utility.
 * Reads from the in-memory 'features' config loaded by ConfigLoader.
 *
 * Usage:
 *   import { isEnabled } from '../utils/feature.js';
 *   if (isEnabled('payment.enabled')) { ... }
 */

import configLoader from '../config/loader.js';

/**
 * Traverse a dot-delimited path through the features config.
 * Returns the resolved value, or undefined if the path does not exist.
 *
 * @param {string} flagPath  e.g. 'payment.enabled', 'auth.phone_otp_enabled'
 * @returns {*}
 */
function getFlag(flagPath) {
    let config;
    try {
        config = configLoader.get('features');
    } catch {
        console.warn('[Feature] Features config not loaded yet — returning undefined for:', flagPath);
        return undefined;
    }

    const parts = flagPath.split('.');
    let current = config;
    for (const part of parts) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return undefined;
        }
        current = current[part];
    }
    return current;
}

/**
 * Check whether a feature flag is truthy.
 *
 * @param {string} flagPath  Dot-notation path into features.config.json
 * @returns {boolean}
 */
function isEnabled(flagPath) {
    return Boolean(getFlag(flagPath));
}

/**
 * Retrieve the raw value of a feature flag (numbers, strings, etc.).
 *
 * @param {string} flagPath
 * @param {*} [defaultValue]
 * @returns {*}
 */
function getFeatureValue(flagPath, defaultValue = undefined) {
    const val = getFlag(flagPath);
    return val !== undefined ? val : defaultValue;
}

export { isEnabled, getFeatureValue };
