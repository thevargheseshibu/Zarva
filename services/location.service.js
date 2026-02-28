import { geocodePincode } from './geocoding.service.js';

/**
 * Process location payload combining GPS primary vs Pincode fallback
 * Returns WKT format for PostGIS and the metadata for insertion.
 * @param {{latitude?: number, longitude?: number, pincode?: string, city?: string}} data
 */
export async function processLocation(data) {
    if (data.latitude && data.longitude) {
        // Primary path: GPS available
        return {
            location: `POINT(${data.longitude} ${data.latitude})`,
            location_source: 'gps',
            latitude: parseFloat(data.latitude),
            longitude: parseFloat(data.longitude),
            pincode: data.pincode || null,
            city: data.city || 'Kochi',
            district: data.district || null,
            formatted_address: data.formatted_address || null
        };
    } else if (data.pincode) {
        // Fallback: Geocode pincode to coordinates
        const coords = await geocodePincode(data.pincode, data.city);
        return {
            location: `POINT(${coords.longitude} ${coords.latitude})`,
            location_source: 'pincode_geocoded',
            latitude: parseFloat(coords.latitude),
            longitude: parseFloat(coords.longitude),
            pincode: data.pincode,
            city: coords.city || data.city || 'Kochi',
            district: coords.district || data.district || null,
            formatted_address: coords.formatted_address || data.formatted_address || null
        };
    } else {
        throw new Error('Either coordinates or pincode required');
    }
}
