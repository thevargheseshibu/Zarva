/**
 * utils/encryption.js
 * AES-256-GCM encryption for sensitive data (e.g., bank account numbers).
 * Encryption key from env BANK_ACCOUNT_ENCRYPTION_KEY (32 bytes hex).
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

/**
 * Get encryption key from env. Must be 64 hex chars (32 bytes).
 * @returns {Buffer}
 */
function getKey() {
    const keyHex = process.env.BANK_ACCOUNT_ENCRYPTION_KEY;
    if (!keyHex || keyHex.length !== 64) {
        throw new Error('BANK_ACCOUNT_ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
    return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypt plaintext. Returns base64 string: iv:authTag:ciphertext.
 * @param {string} plaintext
 * @returns {string}
 */
export function encrypt(plaintext) {
    const key = getKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');
    const authTag = cipher.getAuthTag();
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
}

/**
 * Decrypt ciphertext produced by encrypt().
 * @param {string} ciphertext - format iv:authTag:encrypted
 * @returns {string}
 */
export function decrypt(ciphertext) {
    const key = getKey();
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
        throw new Error('Invalid encrypted format');
    }
    const [ivB64, authTagB64, encB64] = parts;
    const iv = Buffer.from(ivB64, 'base64');
    const authTag = Buffer.from(authTagB64, 'base64');
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encB64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
}

/**
 * Generate a random 32-byte hex key for BANK_ACCOUNT_ENCRYPTION_KEY.
 * Run once: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */
export function generateKey() {
    return crypto.randomBytes(KEY_LENGTH).toString('hex');
}
