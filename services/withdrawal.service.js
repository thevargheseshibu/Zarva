/**
 * services/withdrawal.service.js
 * Worker withdrawal and bank account management.
 */

import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database.js';
import * as walletService from './wallet.service.js';
import { encrypt } from '../utils/encryption.js';

const MAX_SINGLE_WITHDRAWAL_PAISE = walletService.MAX_SINGLE_WITHDRAWAL_PAISE;
const MAX_DAILY_WITHDRAWAL_PAISE = walletService.MAX_DAILY_WITHDRAWAL_PAISE;

/**
 * Add bank account (encrypted).
 */
export async function addBankAccount(workerId, payload) {
    const { account_holder_name, account_number, ifsc_code, bank_name, set_primary } = payload;

    if (!account_holder_name || !account_number || !ifsc_code) {
        throw Object.assign(new Error('account_holder_name, account_number, ifsc_code required'), { status: 400 });
    }

    const pool = getPool();
    let encryptedAccount;
    try {
        encryptedAccount = encrypt(account_number.replace(/\s/g, ''));
    } catch (err) {
        throw Object.assign(new Error('Encryption not configured. Set BANK_ACCOUNT_ENCRYPTION_KEY.'), { status: 500 });
    }

    if (set_primary) {
        await pool.query(
            `UPDATE worker_bank_accounts SET is_primary = FALSE WHERE worker_id = $1`,
            [workerId]
        );
    }

    const [rows] = await pool.query(
        `INSERT INTO worker_bank_accounts (worker_id, account_holder_name, account_number_encrypted, ifsc_code, bank_name, is_primary)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, account_holder_name, ifsc_code, bank_name, is_primary, is_verified, created_at`,
        [workerId, account_holder_name, encryptedAccount, ifsc_code.toUpperCase(), bank_name || null, !!set_primary]
    );

    return { bank_account: rows[0], masked_account: `****${account_number.slice(-4)}` };
}

/**
 * List worker's bank accounts (no decryption).
 */
export async function listBankAccounts(workerId) {
    const pool = getPool();
    const [rows] = await pool.query(
        `SELECT id, account_holder_name, ifsc_code, bank_name, is_primary, is_verified, created_at
         FROM worker_bank_accounts WHERE worker_id = $1 ORDER BY is_primary DESC, created_at ASC`,
        [workerId]
    );
    return { bank_accounts: rows };
}

/**
 * Remove bank account.
 */
export async function removeBankAccount(workerId, accountId) {
    const pool = getPool();
    const [rows] = await pool.query(
        `DELETE FROM worker_bank_accounts WHERE id = $1 AND worker_id = $2 RETURNING id`,
        [accountId, workerId]
    );
    if (!rows[0]) {
        throw Object.assign(new Error('Bank account not found'), { status: 404 });
    }
    return { removed: true };
}

/**
 * Initiate withdrawal.
 */
export async function initiateWithdrawal(workerId, amountPaise, bankAccountId, idempotencyKey) {
    if (amountPaise <= 0 || amountPaise > MAX_SINGLE_WITHDRAWAL_PAISE) {
        throw Object.assign(new Error(`Amount must be between 1 and ${MAX_SINGLE_WITHDRAWAL_PAISE} paise`), { status: 400 });
    }

    const pool = getPool();
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    try {
        const available = await walletService.getAvailableBalance(workerId);
        if (amountPaise > available) {
            throw Object.assign(new Error('Insufficient funds'), { status: 400, code: 'INSUFFICIENT_FUNDS' });
        }

        const [bankRows] = await conn.query(
            `SELECT id FROM worker_bank_accounts WHERE id = $1 AND worker_id = $2`,
            [bankAccountId, workerId]
        );
        if (!bankRows[0]) {
            throw Object.assign(new Error('Invalid or unverified bank account'), { status: 400 });
        }

        const key = idempotencyKey || `withdraw_${workerId}_${Date.now()}`;
        const [existing] = await conn.query(
            `SELECT id, status FROM withdrawal_requests WHERE idempotency_key = $1`,
            [key]
        );
        if (existing[0]) {
            await conn.commit();
            return { withdrawal_request: existing[0], is_duplicate: true };
        }

        const requestId = uuidv4();
        await conn.query(
            `INSERT INTO withdrawal_requests (id, worker_id, amount_paise, bank_account_id, status, idempotency_key)
             VALUES ($1, $2, $3, $4, 'pending', $5)`,
            [requestId, workerId, amountPaise, bankAccountId, key]
        );

        await walletService.postWithdrawalEntries(workerId, amountPaise, requestId, conn);

        await conn.commit();

        const [wr] = await pool.query(
            `SELECT id, amount_paise, status, initiated_at FROM withdrawal_requests WHERE id = $1`,
            [requestId]
        );

        // TODO: Trigger actual bank transfer via payment gateway
        // onWithdrawalSuccess / onWithdrawalFailure callbacks

        return { withdrawal_request: wr[0], is_duplicate: false };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}
