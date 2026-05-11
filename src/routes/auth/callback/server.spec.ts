import { beforeEach, describe, expect, it, vi } from 'vitest';

const createSession = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/appwrite', () => ({
	SESSION_COOKIE: '__session',
	createAdminClient: () => ({
		account: {
			createSession
		}
	})
}));

vi.mock('$lib/server/logger', () => ({
	logger: {
		debug: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warn: vi.fn()
	}
}));

import { GET } from './+server';

describe('/auth/callback', () => {
	beforeEach(() => {
		createSession.mockReset();
	});

	it('redirects with a targeted error when the Appwrite API key is missing sessions.write', async () => {
		expect.assertions(1);

		createSession.mockRejectedValue(
			new Error(
				'app.6976647a000420c0c813@service.fra.cloud.appwrite.io (role: applications) missing scopes (["sessions.write"])'
			)
		);

		const event = {
			url: new URL('http://localhost/auth/callback?userId=user-1&secret=oauth-secret'),
			cookies: {
				set: vi.fn()
			},
			platform: undefined
		};

		await expect(GET(event as any)).rejects.toMatchObject({
			status: 302,
			location: '/login?error=appwrite_sessions_scope'
		});
	});
});
