import { beforeEach, describe, expect, it, vi } from 'vitest';

const accountGet = vi.hoisted(() => vi.fn());

vi.mock('$env/dynamic/private', () => ({
	env: {}
}));

vi.mock('$lib/server/appwrite', () => ({
	SESSION_COOKIE: '__session',
	createSessionClient: () => ({
		account: {
			get: accountGet
		}
	})
}));

vi.mock('$lib/server/rate-limit', () => ({
	checkRateLimit: vi.fn(),
	rateLimitHeaders: vi.fn(() => ({})),
	ratelimit: {},
	strictRatelimit: {}
}));

vi.mock('$lib/server/logger', () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn()
	}
}));

import { handle } from './hooks.server';

describe('handle', () => {
	beforeEach(() => {
		accountGet.mockReset();
	});

	it('deletes an invalid session cookie when Appwrite rejects account lookup', async () => {
		expect.assertions(2);

		accountGet.mockRejectedValue({
			code: 401,
			type: 'general_unauthorized_scope'
		});

		const cookies = {
			get: vi.fn(() => 'stale-session'),
			delete: vi.fn()
		};
		const event = {
			url: new URL('http://localhost/login'),
			cookies,
			locals: {},
			getClientAddress: vi.fn(() => '127.0.0.1')
		};
		const resolve = vi.fn(async () => new Response('ok'));

		await handle({ event, resolve } as any);

		expect(cookies.delete).toHaveBeenCalledWith('__session', { path: '/' });
		expect(resolve).toHaveBeenCalledOnce();
	});
});
