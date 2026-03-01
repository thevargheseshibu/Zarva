import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client, getS3BucketName } from '../config/aws.js';

/**
 * Basic S3 upload wrapper for buffers (e.g. from multer)
 * Returns the public URL of the uploaded object
 */
export async function uploadToS3(buffer, s3Key, mimeType) {
    const bucketName = getS3BucketName();
    if (!bucketName) throw new Error('AWS_BUCKET_NAME is not configured');

    const client = getS3Client();
    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: s3Key,
        Body: buffer,
        ContentType: mimeType,
    });

    await client.send(command);

    // Return the standard AWS S3 format URL
    // e.g. https://bucket.s3.region.amazonaws.com/key
    const region = process.env.AWS_REGION || 'ap-south-1';
    return `https://${bucketName}.s3.${region}.amazonaws.com/${s3Key}`;
}
