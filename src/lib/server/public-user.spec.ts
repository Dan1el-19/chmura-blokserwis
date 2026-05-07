import { describe, expect, it } from 'vitest';

import { toPublicUser } from './public-user';

describe('toPublicUser', () => {
	it('returns only safe serializable public user fields', () => {
		expect.assertions(11);

		const sdkUser = {
			$id: 'user-123',
			id: 'legacy-id',
			email: 'user@example.com',
			name: 'Test User',
			avatar: 'https://example.com/avatar.png',
			labels: ['plus'],
			$createdAt: '2026-01-01T00:00:00.000Z',
			$updatedAt: '2026-01-02T00:00:00.000Z',
			password: 'secret',
			sessionSecret: 'session-secret',
			oauthToken: 'oauth-token',
			cookies: 'cookie',
			prefs: { storageLimit: 123 },
			toString: () => 'sdk-user'
		};

		const result = toPublicUser(sdkUser);

		expect(result).toEqual({
			id: 'user-123',
			$id: 'user-123',
			email: 'user@example.com',
			name: 'Test User',
			avatar: 'https://example.com/avatar.png',
			role: 'plus',
			createdAt: '2026-01-01T00:00:00.000Z',
			updatedAt: '2026-01-02T00:00:00.000Z'
		});
		expect(Object.hasOwn(result ?? {}, 'toString')).toBe(false);
		expect(Object.values(result ?? {}).some((value) => typeof value === 'function')).toBe(false);
		expect(JSON.stringify(result)).toBeTypeOf('string');
		expect(result).not.toHaveProperty('password');
		expect(result).not.toHaveProperty('sessionSecret');
		expect(result).not.toHaveProperty('oauthToken');
		expect(result).not.toHaveProperty('cookies');
		expect(result).not.toHaveProperty('prefs');
		expect(result).not.toHaveProperty('labels');
		expect(result).not.toHaveProperty('secret');
	});

	it('returns null for missing users', () => {
		expect.assertions(2);

		expect(toPublicUser(null)).toBeNull();
		expect(toPublicUser(undefined)).toBeNull();
	});
});
