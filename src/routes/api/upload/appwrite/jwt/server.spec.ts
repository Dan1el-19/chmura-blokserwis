import { beforeEach, describe, expect, it, vi } from 'vitest';

const createJWT = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/appwrite', () => ({
	createSessionClient: () => ({ account: { createJWT } })
}));

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { GET } from './+server';

describe('/api/upload/appwrite/jwt GET', () => {
	beforeEach(() => {
		createJWT.mockReset();
	});

	it('returns a JWT for Appwrite SDK auth', async () => {
		createJWT.mockResolvedValue({ jwt: 'appwrite-jwt-token' });

		const response = await GET({
			locals: { user: { $id: 'user-1', labels: ['plus'] } },
			platform: undefined
		} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.jwt).toBe('appwrite-jwt-token');
	});

	it('returns 401 when user is missing', async () => {
		const response = await GET({
			locals: { user: null },
			platform: undefined
		} as never);

		expect(response.status).toBe(401);
	});
});
