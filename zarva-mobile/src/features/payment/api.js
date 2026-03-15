/**
 * src/services/api/walletApi.js
 * ZARVA Wallet API calls.
 */

import apiClient from './client';

/** Worker: get balance */
export function getWorkerBalance() {
    return apiClient.get('/api/wallet/worker/balance');
}

/** Worker: get transactions */
export function getWorkerTransactions(params = {}) {
    return apiClient.get('/api/wallet/worker/transactions', { params });
}

/** Worker: get earnings for job */
export function getWorkerEarnings(jobId) {
    return apiClient.get(`/api/wallet/worker/earnings/${jobId}`);
}

/** Worker: initiate withdrawal */
export function withdraw(amountPaise, bankAccountId, idempotencyKey) {
    return apiClient.post('/api/wallet/worker/withdraw', {
        amount_paise: amountPaise,
        bank_account_id: bankAccountId
    }, {
        headers: idempotencyKey ? { 'X-Idempotency-Key': idempotencyKey } : {}
    });
}

/** Worker: get withdrawals */
export function getWorkerWithdrawals() {
    return apiClient.get('/api/wallet/worker/withdrawals');
}

/** Worker: add bank account */
export function addBankAccount(payload) {
    return apiClient.post('/api/wallet/bank-accounts', payload);
}

/** Worker: list bank accounts */
export function listBankAccounts() {
    return apiClient.get('/api/wallet/bank-accounts');
}

/** Worker: remove bank account */
export function removeBankAccount(accountId) {
    return apiClient.delete(`/api/wallet/bank-accounts/${accountId}`);
}

/** Customer: get outstanding */
export function getCustomerOutstanding() {
    return apiClient.get('/api/wallet/customer/outstanding');
}

/** Customer: get transactions */
export function getCustomerTransactions() {
    return apiClient.get('/api/wallet/customer/transactions');
}

/** Customer: get job payment breakdown */
export function getCustomerJobBreakdown(jobId) {
    return apiClient.get(`/api/wallet/customer/job/${jobId}`);
}
