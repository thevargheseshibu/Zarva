/**
 * services/reconciliation.service.js
 * ZARVA Daily Ledger Reconciliation
 *
 * Two daily cron checks:
 *   1. Global balance: SUM(debits) === SUM(credits) across ALL ledger entries
 *   2. Cache accuracy: wallet_balance_cache matches ledger-computed balance per user account
 *
 * On mismatch → log CRITICAL alert, set system_config flag, pause all withdrawals.
 */

import { getPool } from '../config/database.js';

// ─── Reconciliation Helpers ───────────────────────────────────────────────────

/**
 * Verify that total debits === total credits across all transactions.
 * The double-entry trigger enforces this per-transaction, but this is the
 * system-wide safety net to catch any bypass or data corruption.
 */
async function checkGlobalBalance(pool) {
  const [rows] = await pool.query(`
        SELECT
            SUM(CASE WHEN entry_type = 'debit'  THEN amount_paise ELSE 0 END) AS total_debits,
            SUM(CASE WHEN entry_type = 'credit' THEN amount_paise ELSE 0 END) AS total_credits,
            COUNT(*) AS entry_count
        FROM ledger_entries
    `);

  const debits = Number(rows[0]?.total_debits ?? 0);
  const credits = Number(rows[0]?.total_credits ?? 0);
  const count = Number(rows[0]?.entry_count ?? 0);

  const balanced = debits === credits;
  return { debits, credits, count, balanced, mismatch: debits - credits };
}

/**
 * For every user account in wallet_balance_cache, verify that the cached
 * balance matches the balance computed live from ledger_entries.
 * Returns a list of mismatched accounts.
 */
async function checkBalanceCaches(pool) {
  // Compute live balances from ledger
  const [liveRows] = await pool.query(`
        SELECT
            ua.id AS user_account_id,
            ua.user_id,
            ua.account_code,
            COALESCE(SUM(
                CASE WHEN le.entry_type = 'credit' THEN le.amount_paise ELSE -le.amount_paise END
            ), 0)::BIGINT AS live_balance_paise
        FROM user_accounts ua
        LEFT JOIN ledger_entries le ON le.user_account_id = ua.id
        GROUP BY ua.id, ua.user_id, ua.account_code
    `);

  // Get cached balances
  const [cacheRows] = await pool.query(`
        SELECT user_account_id, balance_paise FROM wallet_balance_cache
    `);
  const cacheMap = new Map(cacheRows.map(r => [r.user_account_id, Number(r.balance_paise)]));

  const mismatches = [];
  for (const row of liveRows) {
    const live = Number(row.live_balance_paise);
    const cached = cacheMap.get(row.user_account_id) ?? null;

    // If cache exists and differs from live by more than 0 paise, flag it
    if (cached !== null && Math.abs(live - cached) > 0) {
      mismatches.push({
        user_account_id: row.user_account_id,
        user_id: row.user_id,
        account_code: row.account_code,
        live_balance_paise: live,
        cached_balance_paise: cached,
        delta_paise: live - cached,
      });
    }
  }

  return mismatches;
}

/**
 * Set a system_config flag (generic key/value upsert).
 */
async function setSystemFlag(pool, key, value) {
  await pool.query(
    `INSERT INTO system_config (namespace, key, value, updated_by)
         VALUES ('zarva', $1, $2, 'reconciliation_cron')
         ON CONFLICT (namespace, key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW(), updated_by = 'reconciliation_cron'`,
    [key, JSON.stringify(value)]
  );
}

/**
 * Pause all worker withdrawals by setting a system flag.
 */
async function pauseWithdrawals(pool, reason) {
  await setSystemFlag(pool, 'reconciliation.withdrawals_paused', true);
  await setSystemFlag(pool, 'reconciliation.pause_reason', reason);
  console.error('[Reconciliation] ⛔ WITHDRAWALS PAUSED:', reason);
}

/**
 * Resume withdrawals after mismatch is resolved.
 */
export async function resumeWithdrawals() {
  const pool = getPool();
  await setSystemFlag(pool, 'reconciliation.withdrawals_paused', false);
  await setSystemFlag(pool, 'reconciliation.pause_reason', null);
  console.log('[Reconciliation] ✅ Withdrawals resumed');
}

/**
 * Check if withdrawals are currently paused.
 */
export async function areWithdrawalsPaused() {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT value FROM system_config WHERE namespace='zarva' AND key='reconciliation.withdrawals_paused'`
  );
  return rows[0]?.value === 'true';
}

// ─── Heal Stale Caches ───────────────────────────────────────────────────────

/**
 * Recompute and fix all stale balance cache entries found in mismatches.
 */
async function healCaches(pool, mismatches) {
  let healed = 0;
  for (const m of mismatches) {
    try {
      // Recompute the live balance and write to cache
      await pool.query(
        `INSERT INTO wallet_balance_cache (user_account_id, balance_paise, pending_paise, available_paise, last_computed_at)
                 VALUES ($1, $2, 0, $2, NOW())
                 ON CONFLICT (user_account_id) DO UPDATE SET
                   balance_paise = EXCLUDED.balance_paise,
                   available_paise = EXCLUDED.balance_paise,
                   last_computed_at = NOW()`,
        [m.user_account_id, m.live_balance_paise]
      );
      healed++;
    } catch (e) {
      console.error(`[Reconciliation] Failed to heal cache for account ${m.user_account_id}:`, e.message);
    }
  }
  return healed;
}

// ─── Main Reconciliation Run ─────────────────────────────────────────────────

/**
 * Run full daily reconciliation.
 * Designed to be called by a cron job (e.g. node-cron or setInterval on server start).
 *
 * @returns {object} Summary report of the reconciliation run
 */
export async function runDailyReconciliation() {
  const pool = getPool();
  const runAt = new Date().toISOString();
  console.log(`[Reconciliation] Starting reconciliation run at ${runAt}`);

  const report = {
    run_at: runAt,
    global_balance: null,
    cache_mismatches: [],
    caches_healed: 0,
    withdrawals_paused: false,
    status: 'ok',
    errors: [],
  };

  try {
    // ── 1. Global balance check ──────────────────────────────────────────
    const globalCheck = await checkGlobalBalance(pool);
    report.global_balance = globalCheck;
    console.log(`[Reconciliation] Global balance — debits: ${globalCheck.debits} credits: ${globalCheck.credits} entries: ${globalCheck.count} balanced: ${globalCheck.balanced}`);

    if (!globalCheck.balanced) {
      const msg = `CRITICAL: Global ledger imbalance! Debits=${globalCheck.debits} Credits=${globalCheck.credits} Mismatch=${globalCheck.mismatch} paise`;
      console.error(`[Reconciliation] ⚠️  ${msg}`);
      report.errors.push(msg);
      report.status = 'failed';
      await pauseWithdrawals(pool, msg);
      report.withdrawals_paused = true;
    }

    // ── 2. Cache accuracy check ──────────────────────────────────────────
    const cacheMismatches = await checkBalanceCaches(pool);
    report.cache_mismatches = cacheMismatches;
    console.log(`[Reconciliation] Cache check — ${cacheMismatches.length} mismatch(es) found`);

    if (cacheMismatches.length > 0) {
      for (const m of cacheMismatches) {
        const msg = `Cache mismatch for user ${m.user_id} account ${m.account_code}: live=${m.live_balance_paise} cached=${m.cached_balance_paise} delta=${m.delta_paise}`;
        console.warn(`[Reconciliation] ⚠️  ${msg}`);
        report.errors.push(msg);
      }

      // Auto-heal: recompute all stale caches
      const healed = await healCaches(pool, cacheMismatches);
      report.caches_healed = healed;
      console.log(`[Reconciliation] Healed ${healed} cache(s)`);
    }

    // ── 3. Record run timestamp ──────────────────────────────────────────
    await setSystemFlag(pool, 'reconciliation.last_run_at', runAt);
    await setSystemFlag(pool, 'reconciliation.last_run_status', report.status);
    if (report.errors.length > 0) {
      await setSystemFlag(pool, 'reconciliation.last_mismatch_details', report.errors);
    }

  } catch (err) {
    const msg = `Reconciliation run failed with error: ${err.message}`;
    console.error('[Reconciliation] FATAL:', err);
    report.status = 'error';
    report.errors.push(msg);

    try {
      await pauseWithdrawals(pool, msg);
      report.withdrawals_paused = true;
    } catch (e2) {
      console.error('[Reconciliation] Could not pause withdrawals:', e2.message);
    }
  }

  console.log(`[Reconciliation] Run complete. Status: ${report.status}`);
  return report;
}

/**
 * Verify a single transaction's balance (useful for post-write checks in tests/admin).
 */
export async function verifyTransaction(transactionId) {
  const pool = getPool();
  const [rows] = await pool.query(
    `SELECT
            SUM(CASE WHEN entry_type='debit'  THEN amount_paise ELSE 0 END)::BIGINT AS debits,
            SUM(CASE WHEN entry_type='credit' THEN amount_paise ELSE 0 END)::BIGINT AS credits
         FROM ledger_entries WHERE transaction_id = $1`,
    [transactionId]
  );
  const debits = Number(rows[0]?.debits ?? 0);
  const credits = Number(rows[0]?.credits ?? 0);
  return { transaction_id: transactionId, debits, credits, balanced: debits === credits };
}
