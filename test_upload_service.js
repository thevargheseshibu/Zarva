import { getPool } from './config/database.js';
import { uploadBufferToS3 } from './services/upload.service.js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.development' });

async function testUpload() {
    const pool = getPool();
    try {
        console.log("--- UPLOAD BUFFER TO S3 TEST ---");
        const userId = 3;
        const purpose = 'worker_doc';
        const filename = 'test.jpg';
        const mimeType = 'image/jpeg';
        const buffer = Buffer.from('fake-image-data');

        const result = await uploadBufferToS3(userId, purpose, filename, mimeType, buffer, pool);
        console.log("Upload result:", result);

        const [tokens] = await pool.query(`
            SELECT * FROM s3_upload_tokens 
            WHERE s3_key = $1
        `, [result.s3_key]);

        if (tokens.length > 0) {
            console.log("SUCCESS: Token found in DB:", tokens[0]);
        } else {
            console.log("FAILURE: Token NOT found in DB!");
        }

        console.log("--- TEST COMPLETE ---");
    } catch (err) {
        console.error("Test failed:", err);
    } finally {
        await pool.end();
    }
}

testUpload();
