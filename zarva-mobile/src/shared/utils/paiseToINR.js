/**
 * src/utils/paiseToINR.js
 * Convert paise to INR display string. No floats for money.
 */

/**
 * @param {number} paise - Amount in paise
 * @returns {string} - e.g. '₹1,234.56'
 */
export function paiseToINR(paise) {
    const rupees = Math.round(paise) / 100;
    return `₹${rupees.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
