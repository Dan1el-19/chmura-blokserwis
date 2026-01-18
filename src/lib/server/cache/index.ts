import { lru } from 'tiny-lru';
import { logger } from '$lib/server/logger';

export const cache = lru(500, 300000);

export function getCached<T>(key: string): T | undefined {
	const value = cache.get(key) as T | undefined;
	if (value !== undefined) {
		logger.debug(`[CACHE HIT] ${key}`);
	} else {
		logger.debug(`[CACHE MISS] ${key}`);
	}
	return value;
}

export function setCache<T>(key: string, value: T): void {
	logger.debug(`[CACHE SET] ${key}`);
	cache.set(key, value);
}

export function deleteCache(key: string): void {
	logger.debug(`[CACHE DELETE] ${key}`);
	cache.delete(key);
}

export function invalidateByPrefix(prefix: string): void {
	const keys = cache.keys();
	let count = 0;
	for (const key of keys) {
		if (key.startsWith(prefix)) {
			cache.delete(key);
			count++;
		}
	}
	if (count > 0) {
		logger.debug(`[CACHE INVALIDATE] ${prefix}* (${count} keys)`);
	}
}

export function clearCache(): void {
	logger.debug('[CACHE CLEAR]');
	cache.clear();
}
