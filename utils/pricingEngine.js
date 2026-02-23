/**
 * utils/pricingEngine.js
 * 
 * Pure functions for ZARVA pricing calculation. Fully decoupled from Express and Database.
 * Depends only on passed-in configuration parameters and arithmetic.
 */

/**
 * Split job duration into day and night hours.
 * night window: night_hours_start (21:00) to night_hours_end (07:00).
 * Assumes job starts at scheduledDate and runs for exactly `hours`.
 * If scheduledDate is not provided (immediate), assumes it starts *now*.
 */
export function calculateNightHours(startDt, durationHours) {
    if (!startDt) startDt = new Date();
    if (!durationHours || durationHours <= 0) return 0;

    // We break the duration into small increments to accurately count time inside the window
    let nightHours = 0;
    const incrementMn = 5; // 5 minute increments for accuracy
    const totalSteps = Math.ceil((durationHours * 60) / incrementMn);

    let currentDt = new Date(startDt.getTime());

    for (let step = 0; step < totalSteps; step++) {
        const hour = currentDt.getHours();

        // Night is >= 21:00 or < 07:00
        if (hour >= 21 || hour < 7) {
            // Fraction of hour
            const fraction = Math.min(incrementMn, (durationHours * 60) - (step * incrementMn)) / 60;
            nightHours += fraction;
        }

        currentDt.setMinutes(currentDt.getMinutes() + incrementMn);
    }

    return Number(nightHours.toFixed(2));
}

/**
 * Calculates travel charge based on parameters.
 */
export function calculateTravelCharge(travelKm, freeRadius, ratePerKm, minCharge, maxCharge) {
    if (!travelKm || travelKm <= 0) return 0;

    const billableKm = Math.max(0, travelKm - freeRadius);
    if (billableKm === 0) return 0; // if billable_km = 0: travel_charge = 0 (no minimum)

    let charge = billableKm * ratePerKm;

    if (minCharge !== undefined && charge < minCharge) charge = minCharge;
    if (maxCharge !== undefined && charge > maxCharge) charge = maxCharge;

    return Number(charge.toFixed(2));
}

/**
 * The core pricing engine computation.
 */
export function calculatePricing(params, config) {
    const {
        category,
        hours,
        travelKm = 0,
        isEmergency = false,
        scheduledAt = null
    } = params;

    const catConfig = config.categories[category];
    if (!catConfig) {
        throw new Error(`Invalid category: ${category}`);
    }

    const hourlyRate = catConfig.rate_per_hour;
    const actualHours = Math.max(hours || catConfig.min_hours, catConfig.min_hours);

    // 1. Base Amount
    const baseAmount = Number((hourlyRate * actualHours).toFixed(2));

    // 2. Travel Charge
    let travelCharge = 0;
    if (config.global_pricing && config.global_pricing.travel) {
        travelCharge = calculateTravelCharge(
            travelKm,
            config.global_pricing.travel.free_km_radius || 0,
            config.global_pricing.travel.petrol_rate_per_km || 0,
            config.global_pricing.travel.min_travel_charge,
            config.global_pricing.travel.max_travel_charge
        );
    }

    // 3. Night Surcharge
    const nightHoursWorked = calculateNightHours(scheduledAt ? new Date(scheduledAt) : new Date(), actualHours);
    const nightBase = Number((hourlyRate * nightHoursWorked).toFixed(2));
    const nightSurchargePercent = config.global_pricing.night_surcharge_percent || 0;
    const nightSurcharge = Number((nightBase * (nightSurchargePercent / 100)).toFixed(2));

    // 4. Emergency Surcharge
    let emergencySurcharge = 0;
    if (isEmergency) {
        const emPercent = config.global_pricing.emergency_surcharge_percent || 0;
        emergencySurcharge = Number((baseAmount * (emPercent / 100)).toFixed(2));
    }

    // 5. Totals
    const subtotal = Number((baseAmount + travelCharge + nightSurcharge + emergencySurcharge).toFixed(2));

    const platformFeePercent = config.global_pricing.platform_commission_percent || 0;
    const platformFee = Number((subtotal * (platformFeePercent / 100)).toFixed(2));

    const totalAmount = Number((subtotal + platformFee).toFixed(2));

    const advancePercent = config.global_pricing.advance_percent || 0;
    const advanceAmount = Number((totalAmount * (advancePercent / 100)).toFixed(2));

    const breakdown = {
        base_amount: baseAmount,
        travel_charge: travelCharge,
        night_surcharge: nightSurcharge,
        emergency_surcharge: emergencySurcharge,
        subtotal: subtotal,
        platform_fee: platformFee,
        total_amount: totalAmount,
        worker_payout: subtotal, // WORKER GETS FULL SUBTOTAL
        advance_amount: advanceAmount,
        balance_due: Number((totalAmount - advanceAmount).toFixed(2))
    };

    return breakdown;
}

/**
 * Helper: Generate Estimates (Range vs Exact)
 */
export function generateEstimate(params, config) {
    const { category, hours, isEmergency, travelKm, scheduledAt } = params;
    const catConfig = config.categories[category];

    if (!catConfig) {
        throw new Error(`Invalid category for estimation: ${category}`);
    }

    // If hours is provided, we calculate exact estimate
    if (hours !== undefined && hours !== null) {
        const exact = calculatePricing({ category, hours, travelKm, isEmergency, scheduledAt }, config);
        return {
            type: 'exact',
            exact_estimate: exact.total_amount,
            advance_amount: exact.advance_amount,
            breakdown: exact
        };
    }

    // Otherwise, generate a range using min_hours and min_hours + 1
    const minH = catConfig.min_hours;
    const maxH = minH + 1;

    const minPricing = calculatePricing({ category, hours: minH, travelKm, isEmergency, scheduledAt }, config);
    const maxPricing = calculatePricing({ category, hours: maxH, travelKm, isEmergency, scheduledAt }, config);

    return {
        type: 'range',
        min_estimate: minPricing.total_amount,
        max_estimate: maxPricing.total_amount,
        // Advance is usually taken on the minimum
        advance_amount: minPricing.advance_amount,
        breakdown_min: minPricing,
        breakdown_max: maxPricing
    };
}
