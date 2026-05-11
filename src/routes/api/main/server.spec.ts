import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminList = vi.hoisted(() => vi.fn());
const userList = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createAdminUnisourceClient: () => ({
		mainStorage: {
			list: adminList
		}
	}),
	createUserUnisourceClient: () => ({
		mainStorage: {
			list: userList
		}
	})
}));

import { GET } from './+server';

describe('/api/main GET', () => {
	beforeEach(() => {
		adminList.mockReset();
		userList.mockReset();
	});

	it('uses the service client for shared main storage after local role authorization', async () => {
		expect.assertions(3);

		adminList.mockResolvedValue({ items: [], next_cursor: null });

		const response = await GET({
			locals: { user: { $id: 'user-1', labels: ['admin'] } },
			url: new URL('http://localhost/api/main'),
			platform: undefined
		} as any);

		expect(response.status).toBe(200);
		expect(adminList).toHaveBeenCalledWith({ cursor: undefined, limit: 50 });
		expect(userList).not.toHaveBeenCalled();
	});
});
