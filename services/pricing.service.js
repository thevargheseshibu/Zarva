
/**
 * services/pricing.service.js
 * 
 * ZARVA Pricing Resolution Service
 * Handles hourly rate resolution, inspection fees, and job billing calculations.
 */

import fs from 'fs';
import path from 'path';

let _config = null;

/**
 * Load config from file and cache in memory.
 * TODO: replace with db.query when migrating to DB.
 */
function getConfig() {
    if (!_config) {
        const configPath = path.resolve('config/zarva-pricing.config.json');
        _config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    return _config;
}

/**
 * Finds the tier for a given city, state, or pincode.
 */
function findCityTier(cityName, stateName, pincode) {
    const config = getConfig();

    // 1. Check all tier buckets for city name match (case-insensitive)
    for (const tierKey of ['TIER_1_METRO', 'TIER_2_LARGE_CITY', 'TIER_3_MID_TOWN', 'TIER_4_SMALL_TOWN']) {
        const bucket = config.cities[tierKey];
        const citiesArray = bucket.cities || bucket.example_cities;

        const match = citiesArray.find(c => {
            const nameMatch = cityName && c.name.toLowerCase() === cityName.toLowerCase();
            const pincodeMatch = pincode && c.pincode_prefixes && c.pincode_prefixes.includes(pincode.substring(0, 3));
            return nameMatch || pincodeMatch;
        });

        if (match) return bucket._tier;
    }

    // 2. Pincode prefix fallback
    if (pincode) {
        const prefix = pincode.substring(0, 3);
        if (config.pincode_tier_map[prefix]) return config.pincode_tier_map[prefix];
    }

    // 3. State default fallback
    if (stateName && config.state_defaults[stateName]) {
        return config.state_defaults[stateName];
    }

    return 2; // global fallback
}

/**
 * FUNCTION 1: resolveHourlyRate
 * Resolves the final hourly rate for a job based on category, location, and time.
 */
export function resolveHourlyRate(serviceCategory, cityName, stateName, pincode, urgencyMultiplier = 1.0, testDate = null) {
    const config = getConfig();

    // 1. Check Service-City Override (Hard Rate)
    const overrideKey = `${serviceCategory}_${cityName}`;
    if (config.service_city_overrides[overrideKey]) {
        const hardRate = config.service_city_overrides[overrideKey];
        return {
            hourly_rate: hardRate * urgencyMultiplier,
            base_rate: hardRate,
            tier: null,
            tier_multiplier: 1.0,
            time_multiplier: 1.0,
            urgency_multiplier: urgencyMultiplier,
            resolved_via: 'city_match_override',
            inspection_rate: Math.ceil((hardRate * urgencyMultiplier) / 4),
            city_name: cityName,
            state_name: stateName
        };
    }

    // 2. Resolve Base Rate for Category
    const baseRate = config.base_hourly_rates[serviceCategory] || config.base_hourly_rates['Service'];

    // 3. Resolve Tier & Multiplier
    const tier = findCityTier(cityName, stateName, pincode);
    const tierMultiplier = config.tier_multipliers[String(tier)] || 1.0;

    // 4. Resolve Time Multiplier (Regular/Evening/Night/Weekend/Holiday)
    const now = testDate || new Date();
    const { multiplier: timeMultiplier, label: timeLabel } = getTimeMultiplier(now);

    // 5. Calculate Final Hourly Rate
    const finalRate = Math.ceil(baseRate * tierMultiplier * timeMultiplier * urgencyMultiplier);

    return {
        hourly_rate: finalRate,
        base_rate: baseRate,
        tier: tier,
        tier_multiplier: tierMultiplier,
        time_multiplier: timeMultiplier,
        urgency_multiplier: urgencyMultiplier,
        resolved_via: 'standard_resolution', // Simplified for logic check
        inspection_rate: Math.ceil(finalRate / 4),
        city_name: cityName,
        state_name: stateName
    };
}

/**
 * FUNCTION 2: calculateInspectionFee
 * Calculates inspection base + travel charge.
 */
export function calculateInspectionFee(hourlyRate, distanceKm) {
    const config = getConfig();
    const freeKmRadius = config.free_km_radius || 5;
    const perKmRate = config.per_km_rate_inr || 15;

    const travelCharge = distanceKm <= freeKmRadius
        ? 0
        : Math.ceil((distanceKm - freeKmRadius) * perKmRate);

    const inspectionBase = Math.ceil(hourlyRate / 4);

    return {
        inspection_base: inspectionBase,
        travel_charge: travelCharge,
        total: inspectionBase + travelCharge
    };
}

/**
 * FUNCTION 3: calculateJobBill
 * Computes billed amount based on timer events and hourly rate.
 */
export function calculateJobBill(timerEvents, hourlyRate, billingCapMinutes = 9999) {
    const config = getConfig();
    const minMinutes = config.billing_minimum_minutes || 30;
    const incrementMinutes = config.billing_increment_minutes || 15;

    let totalElapsedMs = 0;
    let lastStartTs = null;

    // timerEvents: { event_type, server_timestamp }
    timerEvents.forEach(event => {
        const ts = new Date(event.server_timestamp).getTime();
        if (event.event_type === 'job_start' || event.event_type === 'job_resume') {
            lastStartTs = ts;
        } else if (event.event_type === 'job_pause' || event.event_type === 'job_end') {
            if (lastStartTs) {
                totalElapsedMs += (ts - lastStartTs);
                lastStartTs = null;
            }
        }
    });

    const actualMinutes = Math.floor(totalElapsedMs / 60000);

    // Apply Cap
    let billedMinutes = Math.min(actualMinutes, billingCapMinutes);
    const capApplied = actualMinutes > billingCapMinutes;

    // Apply Minimum Block
    billedMinutes = Math.max(billedMinutes, minMinutes);

    // Round up to nearest increment
    if (billedMinutes > minMinutes) {
        const overage = billedMinutes - minMinutes;
        const units = Math.ceil(overage / incrementMinutes);
        billedMinutes = minMinutes + (units * incrementMinutes);
    }

    const billedAmount = Math.ceil((billedMinutes / 60) * hourlyRate);

    return {
        actual_minutes: actualMinutes,
        billed_minutes: billedMinutes,
        billed_amount: billedAmount,
        cap_applied: capApplied
    };
}

/**
 * FUNCTION 4: isHoliday
 */
export function isHoliday(date) {
    const config = getConfig();
    const dateStr = date.toISOString().split('T')[0];
    return config.public_holidays_2026.includes(dateStr);
}

/**
 * FUNCTION 5: getTimeMultiplier
 */
export function getTimeMultiplier(serverTimestamp) {
    const config = getConfig();
    const date = new Date(serverTimestamp);

    // 1. Check Holiday first
    if (isHoliday(date)) {
        return { multiplier: config.holiday_multiplier || 1.5, label: 'holiday' };
    }

    const dayOfWeek = date.getDay(); // 0 (Sun) to 6 (Sat)
    const timeStr = date.toTimeString().substring(0, 5); // "HH:mm"

    // 2. Find matching time range
    const match = config.time_multipliers.find(tm => {
        const dayMatch = tm.days.includes(dayOfWeek);
        if (!dayMatch) return false;

        // Handle overnight ranges (e.g., 22:00 - 08:00)
        if (tm.start > tm.end) {
            return timeStr >= tm.start || timeStr < tm.end;
        }
        return timeStr >= tm.start && timeStr < tm.end;
    });

    if (match) {
        return { multiplier: match.multiplier, label: match.label };
    }

    return { multiplier: 1.0, label: 'regular' };
}
