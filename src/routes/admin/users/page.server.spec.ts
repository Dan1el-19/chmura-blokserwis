import { beforeEach, describe, expect, it, vi } from 'vitest';

type AdminUsersPageResult = {
	users: Array<{ $id: string; role: string }>;
	total: number;
	totalPages: number;
};

const requestAdminUnisourceV2 = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	requestAdminUnisourceV2
}));

import { load } from './+page.server';

describe('/admin/users load', () => {
	beforeEach(() => {
		requestAdminUnisourceV2.mockReset();
	});

	it('loads users from raw UniSource V2 paginated admin envelope', async () => {
		expect.assertions(4);

		requestAdminUnisourceV2.mockResolvedValueOnce({
			items: [
				{
					id: 'user-1',
					email: 'admin@example.com',
					name: 'Admin',
					registration: 1770000000,
					role: 'admin',
					current_used_bytes: 10,
					effective_max_storage_bytes: 100,
					max_storage_bytes: null,
					status: true,
					labels: ['admin'],
					email_verification: true,
					has_service_access: true
				}
			],
			page: { limit: 20, next_cursor: null },
			total: 1,
			offset: 0
		});

		const result = (await load({
			platform: undefined,
			url: new URL('https://beta.chmura.blokserwis.pl/admin/users?page=1')
		} as any)) as AdminUsersPageResult;

		expect(requestAdminUnisourceV2).toHaveBeenCalledWith(
			expect.anything(),
			'GET',
			'/v2/admin/users',
			{ query: { offset: 0, limit: 20 } }
		);
		expect(result.total).toBe(1);
		expect(result.totalPages).toBe(1);
		expect(result.users[0]).toMatchObject({ $id: 'user-1', role: 'admin' });
	});
});
