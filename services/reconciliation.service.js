/**
 * services/reconciliation.service.js
 * Daily reconciliation: verify debit/credit balance, cache vs ledger.
 */

import { getPool } from '../config/database.js';

/**
 * Verify SUM of all debits = SUM of all credits (double-entry integrity).
 */
export async function verifyDoubleEntryBalance() {
    const pool = getPool();
    const [rows] = await pool.query(`
        SELECT
          SUM(CASE WHEN entry_type = 'debit' THEN amount_paise ELSE 0 END) AS total_debits,
          SUM(CASE WHEN entry_type = 'credit' THEN amount_paise ELSE 0 END) AS total_credits
        FROM ledger_entries
    `);
    const debits = Number(rows[0]?.total_debits ?? 0);
    const credits = Number(rows[0]?.total_credits ?? 0);
    const balanced = debits === credits;
    return { debits, credits, balanced };
}

/**
 * Verify each transaction_id has balanced debits = credits.
 */
export async function verifyTransactionBalance() {
    const pool = getPool();
    const [rows] = await pool.query(`
        SELECT transaction_id,
          SUM(CASE WHEN entry_type = 'debit' THEN amount_paise ELSE -amount_paise END) AS net
        FROM ledger_entries
        GROUP BY transaction_id
        HAVING SUM(CASE WHEN entry_type = 'debit' THEN amount_paise ELSE -amount_paise END) != 0
    `);
    return { unbalanced_transactions: rows.length, transactions: rows };
}

/**
 * Verify wallet_balance_cache matches computed ledger balance per user_account.
 */
export async function verifyCacheVsLedger() {
    const pool = getPool();
    const [rows] = await pool.query(`
        WITH computed AS (
          SELECT ua.id AS user_account_id,
            SUM(CASE WHEN le.entry_type = 'credit' THEN le.amount_paise ELSE -le.amount_paise END) AS balance
          FROM user_accounts ua
          LEFT JOIN ledger_entries le ON le.user_account_id = ua.id
          GROUP BY ua.id
        ),
        cached AS (
          SELECT user_account_id, balance_paise FROM wallet_balance_cache
        )
        SELECT c.user_account_id,
          COALESCE(co.balance, 0) AS computed_balance,
          ca.balance_paise AS cached_balance,
          (COALESCE(co.balance, 0) != ca.balance_paise) AS mismatch
        FROM cached ca
        LEFT JOIN computed co ON co.user_account_id = ca.user_account_id
        WHERE COALESCE(co.balance, 0) != ca.balance_paise
    `);
    return { mismatches: rows };
}

/**
 * Run full reconciliation. Returns report; on mismatch, throws or returns alerts.
 */
export async function runDailyReconciliation() {
    const [balanceResult, txnResult, cacheResult] = await Promise.all([
        verifyDoubleEntryBalance(),
        verifyTransactionBalance(),
        verifyCacheVsLedger()
    ]);

    const report = {
        timestamp: new Date().toISOString(),
        double_entry: balanceResult,
        transaction_balance: txnResult,
        cache_vs_ledger: { mismatches: cacheResult.mismatches.length, details: cacheResult.mismatches }
    };

    const hasError =
        !balanceResult.balanced ||
        txnResult.unbalanced_transactions > 0 ||
        cacheResult.mismatches.length > 0;

    return { report, hasError };
}
