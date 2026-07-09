import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestAdminUnisourceV2 = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	requestAdminUnisourceV2
}));

import { actions, load } from './+page.server';

describe('/admin/settings', () => {
	beforeEach(() => {
		requestAdminUnisourceV2.mockReset();
	});

	it('loads settings from the V2 item envelope', async () => {
		requestAdminUnisourceV2.mockResolvedValueOnce({
			item: {
				id: 'default',
				name: 'Default Service',
				max_storage_bytes: 1_024,
				current_used_bytes: 512,
				max_file_size_bytes: 256,
				recommended_upload_destination: 'hybrid',
				created_at: 1_700_000_000
			}
		});

		const result = await load({ locals: { user: { $id: 'admin-1' } } } as never);

		expect(requestAdminUnisourceV2).toHaveBeenCalledWith(
			expect.anything(),
			'GET',
			'/v2/admin/service'
		);
		expect(result).toEqual({
			service: {
				id: 'default',
				name: 'Default Service',
				recommended_upload_destination: 'hybrid'
			}
		});
	});

	it('updates settings through the V2 item-envelope endpoint', async () => {
		requestAdminUnisourceV2.mockResolvedValueOnce({ item: {} });

		const result = await actions.updateSettings({
			locals: { user: { $id: 'admin-1' } },
			request: new Request('https://chmura.example/admin/settings', {
				method: 'POST',
				headers: { 'content-type': 'application/x-www-form-urlencoded' },
				body: new URLSearchParams({ recommended_upload_destination: 'appwrite' })
			})
		} as never);

		expect(requestAdminUnisourceV2).toHaveBeenCalledWith(
			expect.anything(),
			'PATCH',
			'/v2/admin/service/settings',
			{ body: { recommended_upload_destination: 'appwrite' } }
		);
		expect(result).toEqual({ success: true, destination: 'appwrite' });
	});
});
