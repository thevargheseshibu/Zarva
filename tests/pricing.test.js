
/**
 * tests/pricing.test.js
 * 
 * Unit tests for PricingService resolution logic.
 */

import * as PricingService from '../services/pricing.service.js';

async function runTests() {
    console.log('🚀 Starting PricingService Unit Tests...\n');

    const testDate = new Date('2026-02-26T12:00:00Z'); // Thursday Afternoon IST
    // Test 1: Metro City (Tier 1) Resolution
    try {
        const res = PricingService.resolveHourlyRate('Electrical', 'Mumbai', 'Maharashtra', '400001', 1.0, testDate);
        console.log('✅ Test 1 (Mumbai Electrical):', res.hourly_rate === 438 ? 'PASS' : `FAIL (Got ${res.hourly_rate}, expected 438)`);
        // Calculation: 350 (Base) * 1.25 (Tier 1) * 1.0 (Regular) = 437.5 -> 438
    } catch (e) { console.error('❌ Test 1 Error:', e.message); }

    // Test 2: Small Town (Tier 4) Resolution
    try {
        const res = PricingService.resolveHourlyRate('Cleaning', 'Unknown', 'Kerala', '690001', 1.0, testDate);
        // Finds Kerala in state_defaults -> Tier 2 (1.0)
        console.log('✅ Test 2 (Kerala Fallback):', res.hourly_rate === 250 ? 'PASS' : `FAIL (Got ${res.hourly_rate}, expected 250)`);
    } catch (e) { console.error('❌ Test 2 Error:', e.message); }

    // Test 3: Service-City Override
    try {
        const res = PricingService.resolveHourlyRate('AC Service', 'Mumbai', 'Maharashtra', '400001', 1.0, testDate);
        console.log('✅ Test 3 (Mumbai AC Override):', res.hourly_rate === 600 ? 'PASS' : `FAIL (Got ${res.hourly_rate}, expected 600)`);
    } catch (e) { console.error('❌ Test 3 Error:', e.message); }

    // Test 4: Inspection Fee Calculation
    try {
        const res = PricingService.calculateInspectionFee(400, 10);
        // 400/4 = 100 base
        // (10 - 5) * 15 = 75 travel
        console.log('✅ Test 4 (Inspection Fee):', res.total === 175 ? 'PASS' : `FAIL (Got ${res.total}, expected 175)`);
    } catch (e) { console.error('❌ Test 4 Error:', e.message); }

    // Test 5: Job Billing with Minimum Block
    try {
        const events = [
            { event_type: 'job_start', server_timestamp: '2026-02-26T10:00:00Z' },
            { event_type: 'job_end', server_timestamp: '2026-02-26T10:15:00Z' }
        ];
        const res = PricingService.calculateJobBill(events, 400);
        // 15 mins -> minimum 30 mins
        // (30/60) * 400 = 200
        console.log('✅ Test 5 (Min Block Billing):', res.billed_amount === 200 ? 'PASS' : `FAIL (Got ${res.billed_amount}, expected 200)`);
    } catch (e) { console.error('❌ Test 5 Error:', e.message); }

    // Test 6: Job Billing with Pause/Resume
    try {
        const events = [
            { event_type: 'job_start', server_timestamp: '2026-02-26T10:00:00Z' },
            { event_type: 'job_pause', server_timestamp: '2026-02-26T10:30:00Z' },
            { event_type: 'job_resume', server_timestamp: '2026-02-26T11:00:00Z' },
            { event_type: 'job_end', server_timestamp: '2026-02-26T11:30:00Z' }
        ];
        const res = PricingService.calculateJobBill(events, 400);
        // (30 + 30) = 60 mins
        // (60/60) * 400 = 400
        console.log('✅ Test 6 (Pause/Resume Billing):', res.billed_amount === 400 ? 'PASS' : `FAIL (Got ${res.billed_amount}, expected 400)`);
    } catch (e) { console.error('❌ Test 6 Error:', e.message); }

    console.log('\n🏁 Tests Finished.');
}

runTests();
