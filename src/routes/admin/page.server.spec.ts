import { beforeEach, describe, expect, it, vi } from 'vitest';

const usage = vi.hoisted(() => vi.fn());
const listUsers = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createAdminUnisourceClient: () => ({
		admin: {
			usage,
			listUsers
		}
	})
}));

import { load } from './+page.server';

describe('/admin load', () => {
	beforeEach(() => {
		usage.mockReset();
		listUsers.mockReset();
	});

	it('stays within the UniSource admin users page-size limit', async () => {
		expect.assertions(1);

		usage.mockResolvedValue({ current_used_bytes: 0 });
		listUsers.mockResolvedValue({ total: 0, items: [] });

		await load({ platform: undefined } as any);

		expect(listUsers).toHaveBeenCalledWith({ limit: 100 });
	});
});
