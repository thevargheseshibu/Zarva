/**
 * services/whatsapp.service.js — WhatsApp Cloud API Client
 */

import axios from 'axios';

/**
 * Sends an OTP via WhatsApp Cloud API.
 * Temporarily using 'jaspers_market_order_confirmation_v1' template for testing.
 * Template body:
 *   Hi {{1}},
 *   Thank you for your purchase! Your order number is {{2}}.
 *   We'll start getting your farm fresh groceries ready to ship.
 *   Estimated delivery: {{3}}.
 *   We will let you know when your order ships.
 */
export async function sendWhatsAppOTP(phone, otpCode) {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

    if (!phoneNumberId || !accessToken) {
        throw new Error('WhatsApp configuration missing in environment.');
    }

    // WhatsApp Cloud API requires numbers without the '+' sign
    const waPhone = phone.replace('+', '');

    try {
        const response = await axios.post(
            `https://graph.facebook.com/v19.0/${phoneNumberId}/messages`,
            {
                messaging_product: 'whatsapp',
                to: waPhone,
                type: 'template',
                template: {
                    name: 'jaspers_market_order_confirmation_v1',
                    language: { code: 'en_US' },
                    components: [
                        {
                            type: 'body',
                            parameters: [
                                { type: 'text', text: 'User' },           // → {{1}} name
                                { type: 'text', text: String(otpCode) },  // → {{2}} using as OTP
                                { type: 'text', text: 'N/A' }             // → {{3}} delivery date
                            ]
                        }
                    ]
                }
            },
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        console.log(`[WhatsApp] OTP sent to ${phone}. Message ID:`, response.data.messages?.[0]?.id);
        return true;

    } catch (err) {
        const errorData = err.response?.data?.error;

        if (errorData) {
            console.error(`[WhatsApp] Meta API Error for ${phone}:`, {
                status: err.response?.status,
                code: errorData.code,
                message: errorData.message,
                details: errorData.error_data?.details,
                type: errorData.type,
                fbtrace_id: errorData.fbtrace_id
            });

            // Specific actionable advice for common errors
            if (errorData.code === 131030) {
                console.warn('[WhatsApp] RECIPIENT NOT IN TEST LIST: Add number to Meta Developer Console > WhatsApp > API Setup');
            } else if (errorData.code === 100) {
                console.warn('[WhatsApp] INVALID PARAMETER: Check phone number format or template components.');
            } else if (errorData.code === 190) {
                console.warn('[WhatsApp] TOKEN EXPIRED: Regenerate System User Access Token in Meta Business Suite.');
            }
        } else {
            console.error(`[WhatsApp] Unexpected Network/Internal Error:`, err.message);
        }

        // Throw a structured error that the route handler can use to explain the failure
        const msg = errorData?.message || 'WhatsApp service unavailable.';
        throw Object.assign(new Error(msg), {
            status: err.response?.status || 502,
            code: 'WHATSAPP_DISPATCH_FAILED'
        });
    }
}