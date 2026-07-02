import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { ENV } from '$lib/server/env';
import { logger } from '$lib/server/logger';

const hasRedis = !!(ENV.UPSTASH_REDIS_REST_URL && ENV.UPSTASH_REDIS_REST_TOKEN);

let redis: Redis | null = null;
if (hasRedis) {
	redis = new Redis({
		url: ENV.UPSTASH_REDIS_REST_URL!,
		token: ENV.UPSTASH_REDIS_REST_TOKEN!
	});
	logger.info('[rate-limit] Using Upstash Redis rate limiter');
} else {
	logger.warn('[rate-limit] Upstash Redis not configured — using in-memory fallback rate limiter');
}

export const RATE_LIMIT_ENABLED = true;

export interface RateLimitResult {
	success: boolean;
	limit: number;
	remaining: number;
	reset: number;
}

// --- In-memory fallback (per-process, not suitable for multi-instance) ---

interface InMemoryWindow {
	count: number;
	resetAt: number;
}

class InMemorySlidingWindowLimiter {
	private windows = new Map<string, InMemoryWindow>();
	private maxRequests: number;
	private windowMs: number;

	constructor(maxRequests: number, window: string) {
		this.maxRequests = maxRequests;
		this.windowMs = parseWindowMs(window);
	}

	async limit(identifier: string): Promise<RateLimitResult> {
		const now = Date.now();
		const key = `${identifier}`;
		let entry = this.windows.get(key);

		if (!entry || now >= entry.resetAt) {
			entry = { count: 0, resetAt: now + this.windowMs };
			this.windows.set(key, entry);
		}

		entry.count++;
		const remaining = Math.max(0, this.maxRequests - entry.count);
		const success = entry.count <= this.maxRequests;

		// Cleanup stale entries every ~1000 calls
		if (Math.random() < 0.001) {
			for (const [k, v] of this.windows) {
				if (now >= v.resetAt) this.windows.delete(k);
			}
		}

		return {
			success,
			limit: this.maxRequests,
			remaining,
			reset: Math.ceil(entry.resetAt / 1000)
		};
	}
}

function parseWindowMs(window: string): number {
	const match = window.match(/^(\d+)\s*(s|m|h|d)$/);
	if (!match) return 60_000;
	const value = parseInt(match[1], 10);
	switch (match[2]) {
		case 's':
			return value * 1000;
		case 'm':
			return value * 60_000;
		case 'h':
			return value * 3600_000;
		case 'd':
			return value * 86400_000;
		default:
			return 60_000;
	}
}

// --- Limiter instances ---

type DurationStr = `${number} ${'s' | 'm' | 'h' | 'd'}` | `${number}${'s' | 'm' | 'h' | 'd'}`;

function createLimiter(
	maxRequests: number,
	window: DurationStr,
	prefix: string
): Ratelimit | InMemorySlidingWindowLimiter {
	if (hasRedis && redis) {
		return new Ratelimit({
			redis,
			limiter: Ratelimit.slidingWindow(maxRequests, window),
			analytics: true,
			prefix
		});
	}
	return new InMemorySlidingWindowLimiter(maxRequests, window);
}

const _ratelimit = createLimiter(30, '60 s', 'chmura-blokserwis');
const _strictRatelimit = createLimiter(10, '60 s', 'chmura-blokserwis:strict');
const _uploadRatelimit = createLimiter(100, '60 s', 'chmura-blokserwis:upload');

export {
	_ratelimit as ratelimit,
	_strictRatelimit as strictRatelimit,
	_uploadRatelimit as uploadRatelimit
};

export async function checkRateLimit(
	identifier: string,
	limiter: Ratelimit | InMemorySlidingWindowLimiter = _ratelimit
): Promise<RateLimitResult> {
	const { success, limit, remaining, reset } = await limiter.limit(identifier);
	return { success, limit, remaining, reset };
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
	return {
		'X-RateLimit-Limit': result.limit.toString(),
		'X-RateLimit-Remaining': result.remaining.toString(),
		'X-RateLimit-Reset': result.reset.toString()
	};
}
