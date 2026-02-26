import client from './client.js';

class CoverageAPI {

    // Check before showing job creation form
    async checkServiceability(latitude, longitude, serviceType) {
        const response = await client.post('/api/coverage/check', {
            latitude,
            longitude,
            service_type: serviceType
        });
        return response.data; // { is_serviceable, available_workers_count, nearest_worker_distance_km }
    }

    // For worker onboarding - visualize coverage area
    async updateServiceArea(latitude, longitude, radiusKm, serviceTypes) {
        const response = await client.post('/api/worker/onboarding/service-area', {
            latitude,
            longitude,
            radius_km: radiusKm,
            service_types: serviceTypes
        });
        return response.data;
    }

    // For map data
    async getMapData(latitude, longitude, serviceType) {
        const response = await client.post('/api/coverage/map-data', {
            latitude,
            longitude,
            service_type: serviceType
        });
        return response.data;
    }
}

export default new CoverageAPI();
