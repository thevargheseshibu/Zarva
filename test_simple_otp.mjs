/**
 * Simple test to verify OTP functionality
 */

import 'dotenv/config';
import { getPool } from './config/database.js';
import { getRedisClient } from './config/redis.js';
import bcrypt from 'bcrypt';

async function simpleTest() {
    const pool = getPool();
    const redis = getRedisClient();
    
    try {
        console.log('=== Simple OTP Test ===');
        
        // Test 1: Basic OTP generation and verification
        console.log('\n1. Testing OTP generation and verification...');
        const otp = Math.floor(1000 + Math.random() * 9000).toString();
        const hash = await bcrypt.hash(otp, 10);
        
        console.log(`Generated OTP: ${otp}`);
        console.log(`Generated Hash: ${hash.substring(0, 20)}...`);
        
        // Test verification
        const isValid = await bcrypt.compare(otp, hash);
        console.log(`OTP verification: ${isValid ? 'PASS' : 'FAIL'}`);
        
        // Test 2: Redis storage
        console.log('\n2. Testing Redis storage...');
        const testKey = 'zarva:otp:test:12345';
        await redis.set(testKey, otp, 'EX', 60);
        const retrievedOtp = await redis.get(testKey);
        console.log(`Redis storage: ${retrievedOtp === otp ? 'PASS' : 'FAIL'}`);
        
        // Test 3: Amount calculation logic
        console.log('\n3. Testing amount calculation logic...');
        const laborPaise = 15000; // ₹150
        const materialPaise = 5000; // ₹50
        const totalPaise = laborPaise + materialPaise;
        
        const workerShare = Math.floor(laborPaise * 0.70);
        const platformShare = Math.floor(laborPaise * 0.25);
        const gatewayFee = Math.floor(laborPaise * 0.02);
        const gst = laborPaise - workerShare - platformShare - gatewayFee;
        
        const checkSum = workerShare + materialPaise + platformShare + gatewayFee + gst;
        console.log(`Labor: ₹${laborPaise/100}, Materials: ₹${materialPaise/100}, Total: ₹${totalPaise/100}`);
        console.log(`Worker: ₹${workerShare/100}, Platform: ₹${platformShare/100}, Gateway: ₹${gatewayFee/100}, GST: ₹${gst/100}`);
        console.log(`Checksum: ${checkSum === totalPaise ? 'BALANCED' : 'UNBALANCED'}`);
        
        // Test 4: Material amount change detection
        console.log('\n4. Testing material amount change detection...');
        const declaredMaterials = 5000;
        const currentMaterials = 7500; // Worker added more materials
        
        const shouldRegenerate = currentMaterials !== declaredMaterials;
        console.log(`Declared: ₹${declaredMaterials/100}, Current: ₹${currentMaterials/100}`);
        console.log(`Should regenerate OTP: ${shouldRegenerate ? 'YES' : 'NO'}`);
        
        console.log('\n=== All Tests Completed ===');
        
    } catch (error) {
        console.error('Test failed:', error.message);
    } finally {
        await pool.end();
        await redis.quit();
    }
}

simpleTest();