import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { ENV } from '$lib/server/env';

const redis = new Redis({
	url: ENV.UPSTASH_REDIS_REST_URL,
	token: ENV.UPSTASH_REDIS_REST_TOKEN
});

export const ratelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(30, '60 s'),
	analytics: true,
	prefix: 'chmura-blokserwis'
});

export const strictRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(10, '60 s'),
	analytics: true,
	prefix: 'chmura-blokserwis:strict'
});

export const uploadRatelimit = new Ratelimit({
	redis,
	limiter: Ratelimit.slidingWindow(100, '60 s'),
	analytics: true,
	prefix: 'chmura-blokserwis:upload'
});

export interface RateLimitResult {
	success: boolean;
	limit: number;
	remaining: number;
	reset: number;
}

export async function checkRateLimit(
	identifier: string,
	limiter: Ratelimit = ratelimit
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
