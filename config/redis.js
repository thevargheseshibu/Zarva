/**
 * Redis client (ioredis).
 * Singleton with lazy connect and graceful error handling.
 */

import Redis from 'ioredis';

let client = null;

/**
 * Create and return the singleton Redis client.
 * @returns {Redis}
 */
function getRedisClient() {
    if (client) return client;

    const options = {
        host: process.env.REDIS_HOST || 'localhost',
        port: Number(process.env.REDIS_PORT) || 6379,
        db: Number(process.env.REDIS_DB) || 0,
        lazyConnect: true,
        retryStrategy(times) {
            // Exponential back-off capped at 30 s
            const delay = Math.min(times * 500, 30_000);
            console.warn(`[Redis] Reconnect attempt #${times} in ${delay}ms`);
            return delay;
        },
        maxRetriesPerRequest: 3,
    };

    if (process.env.REDIS_PASSWORD) {
        options.password = process.env.REDIS_PASSWORD;
    }

    client = new Redis(options);

    client.on('connect', () => console.log('[Redis] Connected'));
    client.on('ready', () => console.log('[Redis] Ready'));
    client.on('error', (err) => console.error('[Redis] Error:', err.message));
    client.on('close', () => console.warn('[Redis] Connection closed'));
    client.on('reconnecting', () => console.warn('[Redis] Reconnecting…'));

    return client;
}

/**
 * Attempt to connect the Redis client and return status string.
 * @returns {Promise<'connected'|'disconnected'>}
 */
async function connectRedis() {
    const redis = getRedisClient();
    try {
        await redis.connect();
        return 'connected';
    } catch (err) {
        console.error('[Redis] Initial connect failed:', err.message);
        return 'disconnected';
    }
}

/**
 * Ping Redis and return its status string.
 * @returns {Promise<'connected'|'disconnected'>}
 */
async function getRedisStatus() {
    const redis = getRedisClient();
    try {
        const pong = await redis.ping();
        return pong === 'PONG' ? 'connected' : 'disconnected';
    } catch {
        return 'disconnected';
    }
}

export { getRedisClient, connectRedis, getRedisStatus };
