export function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d;
}

export function formatDistance(km) {
    if (km === null || km === undefined || isNaN(km)) return '';
    const numKm = Number(km);
    if (numKm < 1) return `${Math.round(numKm * 1000)} m`;
    return `${numKm.toFixed(1)} km`;
}

/**
 * Calculates travel charge based on distance.
 * ₹8/km after 2km free, min ₹20, max ₹150.
 */
export function calculateTravelCharge(km) {
    if (!km || km <= 2) return 20; // Min charge
    const chargeableKm = km - 2;
    const charge = 20 + (chargeableKm * 8);
    return Math.min(Math.max(charge, 20), 150);
}
