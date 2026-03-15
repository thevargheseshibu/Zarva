/**
 * src/features/payment/types.js
 * Type definitions for Invoicing and Settlements.
 *
 * @typedef {Object} InvoiceBreakdown
 * @property {number} job_duration_minutes - Total billable minutes
 * @property {number} actual_hours - Decimal hours rounded/padded
 * @property {number} base_amount - Labour cost sum
 * @property {number} material_components_sum - Cost of parts added by worker
 * @property {number} travel_charge - Fixed/distance-based transport fee
 * @property {number} subtotal - Sum of parts + labour + travel
 * @property {number} platform_fee - ZARVA commission
 * @property {number} taxes - Applicable local taxes
 * @property {number} grand_total - Aggregate bill
 * @property {number} advance_amount_paid - Sum credited before finalization
 * @property {number} balance_due - Difference remaining
 *
 * @typedef {Object} InvoiceData
 * @property {string|number} invoice_number
 * @property {string|number} job_id
 * @property {string|number} customer_id
 * @property {string|number} worker_id
 * @property {number} actual_hours
 * @property {InvoiceBreakdown} invoice_breakdown
 * @property {string} generated_at - ISO timestamp
 * @property {string} status - 'pending'|'paid'|'failed'
 *
 * @typedef {Object} PaymentStoreState
 * @property {InvoiceData|null} invoice - Current bill preview or final copy
 * @property {boolean} isFetchingInvoice - API operation flag
 * @property {string|null} invoiceError - Readable reason for generator failure
 * @property {'idle'|'loading'|'success'|'error'} paymentStatus - Action lifeline
 * @property {string|null} paymentError - Feedback on payment gateway issues
 * @property {boolean} isConfirming - Atomic lock guard against duplicate charges
 * @property {number} walletBalance - Pre-loaded customer credit in base units
 * @property {string} walletCurrency - ISO fiat identifier (e.g. 'INR')
 * @property {boolean} isFetchingWallet
 */

export {}; // Make it an ES module
