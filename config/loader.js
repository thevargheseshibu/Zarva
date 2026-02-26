/**
 * ConfigLoader — loads JSON config files, merges DB overrides, caches in memory.
 * DB system_config table wins over file values.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONFIG_NAMES = ['features', 'zarva', 'jobs', 'review', 'notifications'];
/**
 * Deep-merge source into target (source wins on conflicts).
 * @param {object} target
 * @param {object} source
 * @returns {object}
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      typeof result[key] === 'object' &&
      result[key] !== null &&
      !Array.isArray(result[key])
    ) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

class ConfigLoader {
  constructor() {
    /** @type {Map<string, object>} */
    this._cache = new Map();
    /** @type {import('mysql2/promise').Pool | null} */
    this._pool = null;
  }

  /**
   * Attach the DB pool so ConfigLoader can pull DB overrides.
   * Call this after DB pool is initialised (non-blocking — pool absence is tolerated).
   * @param {import('mysql2/promise').Pool} pool
   */
  setPool(pool) {
    this._pool = pool;
  }

  /**
   * Load a single config by name (e.g. 'features').
   * Reads JSON file → deep-merges DB system_config overrides on top.
   * @param {string} name
   * @returns {Promise<object>}
   */
  async load(name) {
    const filePath = join(__dirname, `${name}.config.json`);

    let fileConfig = {};
    try {
      const raw = await readFile(filePath, 'utf-8');
      fileConfig = JSON.parse(raw);
    } catch (err) {
      console.warn(`[ConfigLoader] Could not read ${name}.config.json:`, err.message);
    }

    // Attempt to pull DB overrides from system_config table
    let dbOverrides = {};
    if (this._pool) {
      try {
        const [rows] = await this._pool.query(
          'SELECT "key", "value" FROM system_config WHERE namespace = $1 AND is_active = true',
          [name]
        );
        for (const row of rows) {
          try {
            // Values stored as JSON strings in DB
            const parsed = JSON.parse(row.value);
            // Build nested path from dot-notation key
            const parts = row.key.split('.');
            let target = dbOverrides;
            for (let i = 0; i < parts.length - 1; i++) {
              target[parts[i]] = target[parts[i]] || {};
              target = target[parts[i]];
            }
            target[parts[parts.length - 1]] = parsed;
          } catch {
            // Value is plain string / number
            const parts = row.key.split('.');
            let target = dbOverrides;
            for (let i = 0; i < parts.length - 1; i++) {
              target[parts[i]] = target[parts[i]] || {};
              target = target[parts[i]];
            }
            target[parts[parts.length - 1]] = row.value;
          }
        }
      } catch (err) {
        // DB not ready yet — use file-only config
        console.warn(`[ConfigLoader] DB override fetch skipped for "${name}":`, err.message);
      }
    }

    const merged = deepMerge(fileConfig, dbOverrides);
    this._cache.set(name, merged);
    return merged;
  }

  /**
   * Reload a single config (bypass cache).
   * @param {string} name
   * @returns {Promise<object>}
   */
  async reload(name) {
    return this.load(name);
  }

  /**
   * Load all known configs on startup.
   * @returns {Promise<void>}
   */
  async loadAllConfigs() {
    await Promise.all(CONFIG_NAMES.map((n) => this.load(n)));
    console.log(`[ConfigLoader] Loaded configs: ${CONFIG_NAMES.join(', ')}`);
  }

  /**
   * Retrieve a cached config by name.
   * @param {string} name
   * @returns {object}
   */
  get(name) {
    if (!this._cache.has(name)) {
      throw new Error(`[ConfigLoader] Config "${name}" not loaded. Call loadAllConfigs() first.`);
    }
    return this._cache.get(name);
  }

  /**
   * Names of all currently loaded configs.
   * @returns {string[]}
   */
  loadedNames() {
    return [...this._cache.keys()];
  }
}

// Singleton instance
const configLoader = new ConfigLoader();

export default configLoader;
export { ConfigLoader };
