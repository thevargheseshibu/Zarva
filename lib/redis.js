/**
 * lib/redis.js - Redis client utilities
 */

import { getRedisClient as getRedisClientFromConfig } from '../config/redis.js';

export { getRedisClientFromConfig as getRedisClient };