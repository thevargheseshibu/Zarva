/**
 * services/upload.service.js — S3 Pre-signed Upload Logic
 *
 * Core business logic separating AWS presigning, URL generation,
 * and s3_upload_tokens database persistence.
 */

import { randomUUID } from 'node:crypto';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { getS3Client, getS3BucketName } from '../config/aws.js';

const UPLOAD_EXPIRY_SECONDS = 15 * 60; // 15 mins for PUT
const VIEW_EXPIRY_SECONDS = 60 * 60; // 1 hour for GET

/**
 * Valid upload purposes aligning with DB constants / application needs
 * Each purpose generally maps to a specific S3 path prefix.
 */
const VALID_PURPOSES = new Set([
    'worker_doc',
    'job_photo',
    'profile_photo',
    'extension_proof'
]);

/**
 * Sanitize extension (e.g., 'image/jpeg' -> 'jpeg')
 */
function getExtension(mimeType) {
    if (!mimeType) return 'bin';
    const parts = mimeType.split('/');
    return parts.length === 2 ? parts[1].toLowerCase() : 'bin';
}

/**
 * Generate a short-lived pre-signed PUT URL for uploading file bytes securely
 * directly to S3. Logs the generated token to the DB.
 *
 * @param {string|number} userId
 * @param {string} purpose
 * @param {string} filename
 * @param {string} mimeType
 * @param {object} pool       pg pool instance
 * @returns {Promise<{ upload_url: string, s3_key: string, expires_at: Date }>}
 */
export async function generatePresignedUpload(userId, purpose, filename, mimeType, pool) {
    if (!VALID_PURPOSES.has(purpose)) {
        throw Object.assign(new Error(`Invalid upload purpose: ${purpose}`), { status: 400 });
    }

    const bucketName = getS3BucketName();
    if (!bucketName) {
        throw Object.assign(new Error('AWS S3 bucket name is missing in configuration.'), { status: 500 });
    }

    // Generate unique path: purpose/userId/uuid.ext
    const ext = getExtension(mimeType);
    const s3Key = `${purpose}/${userId}/${randomUUID()}.${ext}`;

    // AWS v3 SDK: Define command & ask for signed url
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        ContentType: mimeType,
        // Provide generic metadata if helpful:
        Metadata: {
            original_filename: filename,
            uploader_user_id: String(userId),
        },
    });

    const uploadUrl = await getSignedUrl(getS3Client(), command, {
        expiresIn: UPLOAD_EXPIRY_SECONDS,
    });

    const expiresAt = new Date(Date.now() + UPLOAD_EXPIRY_SECONDS * 1000);

    // Mark in DB schema (is_used defaults to 0)
    console.log(`[Uploads Service] Logging token to DB s3_upload_tokens: U:${userId} S3Key:${s3Key}`);
    await pool.query(
        `INSERT INTO s3_upload_tokens (user_id, s3_key, purpose, expires_at)
     VALUES ($1, $2, $3, $4)`,
        [userId, s3Key, purpose, expiresAt]
    );

    console.log(`[Uploads Service] DB Logging complete. Returning URL payload.`);
    return {
        upload_url: uploadUrl,
        s3_key: s3Key,
        expires_at: expiresAt,
    };
}

/**
 * Upload a binary buffer directly to S3 from the server.
 * Used for server-side compression before storage.
 */
export async function uploadBufferToS3(userId, purpose, filename, mimeType, buffer, pool) {
    if (!VALID_PURPOSES.has(purpose)) {
        throw Object.assign(new Error(`Invalid upload purpose: ${purpose}`), { status: 400 });
    }

    const bucketName = getS3BucketName();
    if (!bucketName) {
        throw Object.assign(new Error('AWS S3 bucket name is missing in configuration.'), { status: 500 });
    }

    const ext = getExtension(mimeType);
    const s3Key = `${purpose}/${userId}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
        Metadata: {
            original_filename: filename,
            uploader_user_id: String(userId),
        },
    });

    await getS3Client().send(command);
    console.log(`[Uploads Service] Native buffer uploaded to S3: U:${userId} -> ${s3Key}`);

    // Register token in DB so it passes the 'is_used' verification check in services
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour buffer
    await pool.query(
        `INSERT INTO s3_upload_tokens (user_id, s3_key, purpose, expires_at, is_used)
         VALUES ($1, $2, $3, $4, true)`,
        [userId, s3Key, purpose, expiresAt]
    );

    return {
        s3_key: s3Key,
        url: `https://${bucketName}.s3.${process.env.AWS_REGION}.amazonaws.com/${s3Key}`
    };
}


/**
 * Validate that an upload was performed by checking token state.
 * Marks the token as used so it cannot be reused for a different resource.
 *
 * @param {string|number} userId
 * @param {string} s3Key
 * @param {object} pool
 * @returns {Promise<boolean>}
 */
export async function confirmUpload(userId, s3Key, pool) {
    console.log(`[Uploads Service] Verifying S3 Token DB entry: U:${userId} S3Key:${s3Key} `);
    // Check token existence, ownership, unused status, and unexpired
    const [rows] = await pool.query(
        `SELECT id, is_used, expires_at
       FROM s3_upload_tokens
      WHERE user_id = $1 AND s3_key = $2
        LIMIT 1`,
        [userId, s3Key]
    );

    if (rows.length === 0) {
        console.warn(`[Uploads Service] S3 Token NOT FOUND in DB for S3Key:${s3Key} `);
        throw Object.assign(new Error('Invalid or unknown S3 token.'), { status: 404 });
    }

    const token = rows[0];

    if (token.is_used === true) {
        throw Object.assign(new Error('Token already used.'), { status: 409 });
    }

    if (new Date(token.expires_at) < new Date()) {
        console.warn(`[Uploads Service] S3 Token EXPIRED for S3Key:${s3Key} `);
        throw Object.assign(new Error('Upload token expired.'), { status: 400 });
    }

    // Update token to used
    console.log(`[Uploads Service] S3 Token Validated.Updating is_used = true in DB for ID:${token.id} `);
    await pool.query(
        `UPDATE s3_upload_tokens SET is_used = true WHERE id = $1`,
        [token.id]
    );

    return true;
}

/**
 * Generate a short-lived pre-signed GET URL for securely viewing a private
 * S3 object (e.g. for the Admin dashboard viewing KYC docs).
 *
 * @param {string} s3Key
 * @returns {Promise<string|null>}
 */
export async function generateS3Url(s3Key) {
    if (!s3Key) return null;
    const bucketName = getS3BucketName();
    if (!bucketName) return null;

    try {
        const command = new GetObjectCommand({
            Bucket: bucketName,
            Key: s3Key,
        });

        return await getSignedUrl(getS3Client(), command, { expiresIn: VIEW_EXPIRY_SECONDS });
    } catch (err) {
        console.error(`[AWS] Failed to generate signed GET URL for ${s3Key}: `, err.message);
        return null;
    }
}
