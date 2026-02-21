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
            console.error(`[WhatsApp] Failed to send OTP to ${phone}:`, {
                code: errorData.code,
                message: errorData.message,
                details: errorData.error_data?.details,
                fbtrace_id: errorData.fbtrace_id
            });

            if (errorData.code === 131030) {
                console.error('[WhatsApp] Fix: Add recipient to test list → Meta Developer Console → WhatsApp → API Setup');
            } else if (errorData.code === 132001) {
                console.error('[WhatsApp] Fix: Template not found or not approved. Check name and language code.');
            } else if (errorData.code === 190) {
                console.error('[WhatsApp] Fix: Access token expired. Regenerate in Meta Developer Console.');
            }
        } else {
            console.error(`[WhatsApp] Failed to send OTP to ${phone}:`, err.message);
        }

        throw Object.assign(new Error('Failed to send WhatsApp message.'), { status: 502 });
    }
}