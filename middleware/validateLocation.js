/**
 * Middleware to validate location payloads (GPS bounds and Pincode syntax)
 */
export function validateLocationPayload(req, res, next) {
    const { latitude, longitude, pincode, city } = req.body;

    // Reject if both GPS and Pincode are missing
    if ((!latitude || !longitude) && !pincode) {
        return res.status(400).json({
            status: 'error',
            message: 'Either GPS coordinates (latitude, longitude) or a Pincode is required to process location.'
        });
    }

    // Validate India Bounds if GPS is given
    // Approximation: 6° to 37°N latitude and 68° to 97°E longitude
    if (latitude && longitude) {
        const lat = parseFloat(latitude);
        const lng = parseFloat(longitude);

        if (isNaN(lat) || isNaN(lng)) {
            return res.status(400).json({ status: 'error', message: 'Invalid coordinate format.' });
        }

        const inIndia = (lat >= 6.0 && lat <= 37.0) && (lng >= 68.0 && lng <= 97.0);
        if (!inIndia) {
            return res.status(400).json({
                status: 'error',
                message: 'Service is currently limited to India. Coordinates are outside acceptable bounds.'
            });
        }
    }

    // Validate Pincode format if given (India: 6 digit numeric)
    if (pincode) {
        const pinRegex = /^[1-9][0-9]{5}$/;
        if (!pinRegex.test(pincode.toString())) {
            return res.status(400).json({
                status: 'error',
                message: 'Invalid pincode format. Please provide a valid 6-digit Indian pincode.'
            });
        }
    }

    req.validatedLocation = {
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        pincode: pincode ? pincode.toString() : null,
        city: city || 'Kochi'
    };

    next();
}
