import { beforeEach, describe, expect, it, vi } from 'vitest';

const adminList = vi.hoisted(() => vi.fn());
const userList = vi.hoisted(() => vi.fn());
const requestAdminUnisourceV2 = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	requestAdminUnisourceV2,
	createAdminUnisourceClient: () => ({
		mainStorage: {
			list: adminList
		}
	}),
	createRequestAdminUnisourceClient: () => ({
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

import { load } from './+page.server';

describe('/main load', () => {
	beforeEach(() => {
		adminList.mockReset();
		userList.mockReset();
		requestAdminUnisourceV2.mockReset();
	});

	it('uses a raw V2 request for shared main storage after local role authorization', async () => {
		expect.assertions(2);

		requestAdminUnisourceV2.mockResolvedValue({ items: [], page: { next_cursor: null, limit: 50 } });

		await load({
			locals: { user: { $id: 'user-1', labels: ['admin'] } },
			url: new URL('http://localhost/main'),
			platform: undefined
		} as any);

		expect(requestAdminUnisourceV2).toHaveBeenCalledWith(
			expect.anything(),
			'GET',
			'/v2/main',
			{ query: { cursor: undefined, limit: 50 } }
		);
		expect(userList).not.toHaveBeenCalled();
	});
});
