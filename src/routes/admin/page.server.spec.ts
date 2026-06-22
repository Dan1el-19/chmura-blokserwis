import { beforeEach, describe, expect, it, vi } from 'vitest';

type AdminPageResult = {
	stats: {
		totalStorage: number;
		storageByDestination: { r2: number; appwrite: number };
		usersByRole: Record<'basic' | 'plus' | 'admin', number>;
	};
};

const getServiceUsage = vi.hoisted(() => vi.fn());
const listUsers = vi.hoisted(() => vi.fn());
const requestAdminUnisourceV2 = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	requestAdminUnisourceV2,
	createAdminUnisourceClient: () => ({
		admin: {
			getServiceUsage,
			listUsers
		}
	}),
	createRequestAdminUnisourceClient: () => ({
		admin: {
			getServiceUsage,
			listUsers
		}
	})
}));

import { load } from './+page.server';

describe('/admin load', () => {
	beforeEach(() => {
		getServiceUsage.mockReset();
		listUsers.mockReset();
		requestAdminUnisourceV2.mockReset();
	});

	it('loads stats from raw UniSource V2 admin envelopes', async () => {
		expect.assertions(5);

		requestAdminUnisourceV2
			.mockResolvedValueOnce({
				item: { current_used_bytes: 9_999, r2_used_bytes: 100, appwrite_used_bytes: 23 }
			})
			.mockResolvedValueOnce({
				items: [
					{ role: 'admin' },
					{ role: 'plus' },
					{ role: 'user' }
				],
				page: { limit: 100, next_cursor: null },
				total: 3,
				offset: 0
			});

		const result = (await load({ platform: undefined } as any)) as AdminPageResult;

		expect(requestAdminUnisourceV2).toHaveBeenNthCalledWith(
			1,
			expect.anything(),
			'GET',
			'/v2/admin/service/usage'
		);
		expect(requestAdminUnisourceV2).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			'GET',
			'/v2/admin/users',
			{ query: { limit: 100 } }
		);
		expect(result.stats.totalStorage).toBe(123);
		expect(result.stats.storageByDestination).toEqual({ r2: 100, appwrite: 23 });
		expect(result.stats.usersByRole).toEqual({ basic: 1, plus: 1, admin: 1 });
	});
});
