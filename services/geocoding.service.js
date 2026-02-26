import fetch from 'node-fetch';
import { getRedisClient } from '../config/redis.js';

// OpenStreetMap Nominatim API requires a custom User-Agent to avoid blocking
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'ZarvaApp/1.0 (contact@zarva.app)';

/**
 * Geocode a pincode + city using Nominatim, with Redis caching
 * @param {string} pincode 
 * @param {string} city 
 * @returns {Promise<{latitude: number, longitude: number, formatted_address: string, city: string}>}
 */
export async function geocodePincode(pincode, city = 'Kochi') {
    if (!pincode) throw new Error('Pincode is required for geocoding');

    const cacheKey = `pincode:${pincode}:${city.toLowerCase()}`;
    const redis = getRedisClient();

    // 1. Check Cache
    if (redis) {
        const cached = await redis.get(cacheKey);
        if (cached) {
            console.log(`[Geocoding] Cache HIT for ${pincode}`);
            return JSON.parse(cached);
        }
    }

    // 2. Fallback to API
    try {
        console.log(`[Geocoding] Cache MISS - Querying Nominatim for ${pincode}`);
        // Query param formatting strictly for India bounds to improve accuracy
        const queryParams = new URLSearchParams({
            postalcode: pincode,
            city: city,
            countrycodes: 'in', // Limit to India
            format: 'json',
            limit: 1
        });

        const response = await fetch(`${NOMINATIM_URL}?${queryParams.toString()}`, {
            headers: {
                'User-Agent': USER_AGENT
            }
        });

        if (!response.ok) {
            throw new Error(`Nominatim API Error: ${response.statusText}`);
        }

        const data = await response.json();

        if (data && data.length > 0) {
            const result = data[0];
            const coordsInfo = {
                latitude: parseFloat(result.lat),
                longitude: parseFloat(result.lon),
                formatted_address: result.display_name,
                city: city
            };

            // 3. Cache the result for 30 days (Pincodes rarely change coordinates)
            if (redis) {
                await redis.set(cacheKey, JSON.stringify(coordsInfo), 'EX', 30 * 24 * 60 * 60);
            }

            return coordsInfo;
        } else {
            console.warn(`[Geocoding] No coordinates found for Pincode: ${pincode}, City: ${city}`);
            throw new Error(`Location not found for pincode ${pincode}`);
        }
    } catch (err) {
        console.error(`[Geocoding] Failed to geocode pincode ${pincode}:`, err);
        throw err;
    }
}
