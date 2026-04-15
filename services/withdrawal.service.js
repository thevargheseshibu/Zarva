/**
 * services/withdrawal.service.js
 * Worker withdrawal and payment methods management.
 */

import { v4 as uuidv4 } from 'uuid';
import { getPool } from '../config/database.js';
import * as walletService from './wallet.service.js';
import { encrypt } from '../utils/encryption.js';

const MAX_SINGLE_WITHDRAWAL_PAISE = walletService.MAX_SINGLE_WITHDRAWAL_PAISE;
const MAX_DAILY_WITHDRAWAL_PAISE = walletService.MAX_DAILY_WITHDRAWAL_PAISE;
const MIN_SINGLE_WITHDRAWAL_PAISE = walletService.MIN_SINGLE_WITHDRAWAL_PAISE;

/**
 * Add or Update Payment Methods (Bank & UPI)
 */
export async function addBankAccount(workerId, payload) {
    const pool = getPool();
    
    // ⭐ Auto-Migrate Schema for UPI support
    await pool.query(`
        ALTER TABLE worker_bank_accounts ADD COLUMN IF NOT EXISTS upi_id VARCHAR(100);
        ALTER TABLE worker_bank_accounts ALTER COLUMN account_number_encrypted DROP NOT NULL;
        ALTER TABLE worker_bank_accounts ALTER COLUMN ifsc_code DROP NOT NULL;
        ALTER TABLE worker_bank_accounts ALTER COLUMN account_holder_name DROP NOT NULL;
        ALTER TABLE withdrawal_requests ADD COLUMN IF NOT EXISTS payout_method VARCHAR(20) DEFAULT 'bank';
    `).catch(() => {}); // Ignore if already exists

    const { id, account_holder_name, account_number, ifsc_code, bank_name, upi_id } = payload;

    let encryptedAccount = null;
    if (account_number) {
        try {
            encryptedAccount = encrypt(account_number.replace(/\s/g, ''));
        } catch (err) {
            throw Object.assign(new Error('Encryption not configured. Set BANK_ACCOUNT_ENCRYPTION_KEY.'), { status: 500 });
        }
    }

    if (!encryptedAccount && !upi_id) {
        throw Object.assign(new Error('You must provide either Bank Account details or a valid UPI ID.'), { status: 400 });
    }

    // Check if worker already has a record
    const [existing] = await pool.query('SELECT id FROM worker_bank_accounts WHERE worker_id = $1 LIMIT 1', [workerId]);

    let row;
    if (existing[0]) {
        // Update existing record (COALESCE keeps old data if new payload is empty, so we don't erase the encrypted account number if they only update UPI)
        const [rows] = await pool.query(`
            UPDATE worker_bank_accounts 
            SET account_holder_name = COALESCE($1, account_holder_name),
                account_number_encrypted = COALESCE($2, account_number_encrypted),
                ifsc_code = COALESCE($3, ifsc_code),
                bank_name = COALESCE($4, bank_name),
                upi_id = COALESCE($5, upi_id)
            WHERE id = $6
            RETURNING id, account_holder_name, ifsc_code, bank_name, upi_id, is_primary, is_verified, created_at
        `, [account_holder_name || null, encryptedAccount, ifsc_code ? ifsc_code.toUpperCase() : null, bank_name || null, upi_id || null, existing[0].id]);
        row = rows[0];
    } else {
        // Insert new record
        const [rows] = await pool.query(`
            INSERT INTO worker_bank_accounts (worker_id, account_holder_name, account_number_encrypted, ifsc_code, bank_name, upi_id, is_primary)
            VALUES ($1, $2, $3, $4, $5, $6, TRUE)
            RETURNING id, account_holder_name, ifsc_code, bank_name, upi_id, is_primary, is_verified, created_at
        `, [workerId, account_holder_name || null, encryptedAccount, ifsc_code ? ifsc_code.toUpperCase() : null, bank_name || null, upi_id || null]);
        row = rows[0];
    }

    return { bank_account: row };
}

/**
 * List worker's bank accounts & UPI
 */
export async function listBankAccounts(workerId) {
    const pool = getPool();
    const [rows] = await pool.query(
        `SELECT id, account_holder_name, ifsc_code, bank_name, upi_id, is_primary, is_verified, created_at
         FROM worker_bank_accounts WHERE worker_id = $1 ORDER BY is_primary DESC, created_at ASC`,
        [workerId]
    );
    return { bank_accounts: rows };
}

/**
 * Initiate withdrawal.
 */
export async function initiateWithdrawal(workerId, amountPaise, bankAccountId, payoutMethod, idempotencyKey) {
    if (amountPaise < MIN_SINGLE_WITHDRAWAL_PAISE || amountPaise > MAX_SINGLE_WITHDRAWAL_PAISE) {
        throw Object.assign(new Error(`Minimum withdrawal is ₹1,000. Maximum is ₹20,000 per transaction.`), { status: 400 });
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
        if (!bankRows[0]) throw Object.assign(new Error('Invalid payment method configuration'), { status: 400 });

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
            `INSERT INTO withdrawal_requests (id, worker_id, amount_paise, bank_account_id, payout_method, status, idempotency_key)
             VALUES ($1, $2, $3, $4, $5, 'pending', $6)`,
            [requestId, workerId, amountPaise, bankAccountId, payoutMethod || 'bank', key]
        );

        // Securely debit the ledger immediately so funds are locked in 'processing'
        await walletService.postWithdrawalEntries(workerId, amountPaise, requestId, conn);

        await conn.commit();

        const [wr] = await pool.query(
            `SELECT id, amount_paise, status, payout_method, initiated_at FROM withdrawal_requests WHERE id = $1`,
            [requestId]
        );

        return { withdrawal_request: wr[0], is_duplicate: false };
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
}

export async function removeBankAccount(workerId, accountId) {
    const pool = getPool();
    await pool.query(`DELETE FROM worker_bank_accounts WHERE id = $1 AND worker_id = $2`, [accountId, workerId]);
    return { removed: true };
}
