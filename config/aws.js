/**
 * config/aws.js — AWS S3 Client singleton
 *
 * Configures the AWS SDK v3 S3Client.
 * Lazy initialises to ensure dotenv has fully loaded in ES module environments.
 */

import { S3Client } from '@aws-sdk/client-s3';

let _s3Client = null;

export function getS3Client() {
    if (_s3Client) return _s3Client;

    const {
        AWS_ACCESS_KEY_ID,
        AWS_SECRET_ACCESS_KEY,
        AWS_REGION,
    } = process.env;

    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION) {
        console.error('[AWS] Missing required S3 environment variables.');
    }

    _s3Client = new S3Client({
        region: AWS_REGION ?? 'ap-south-1',
        credentials: {
            accessKeyId: AWS_ACCESS_KEY_ID ?? '',
            secretAccessKey: AWS_SECRET_ACCESS_KEY ?? '',
        },
    });

    return _s3Client;
}

export function getS3BucketName() {
    return process.env.AWS_BUCKET_NAME;
}
