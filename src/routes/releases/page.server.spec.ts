import { beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createAdminUnisourceClient: () => ({
		releases: {
			list
		}
	})
}));

import { load } from './+page.server';

describe('/releases load', () => {
	beforeEach(() => {
		list.mockReset();
	});

	it('loads releases from UniSource instead of the legacy local Appwrite database', async () => {
		expect.assertions(2);

		list.mockResolvedValue({
			items: [
				{
					id: 'release-1',
					service_id: 'service-1',
					name: 'blokserwis-1.0.0.apk',
					size: 123,
					r2_key: 'releases/blokserwis-1.0.0.apk',
					tags: ['latest'],
					notes: 'Initial',
					force_update: false,
					uploaded_by: 'user-1',
					upload_status: 'completed',
					created_at: '2026-05-08T19:00:00.000Z'
				}
			],
			next_cursor: null
		});

		const result = (await load({ platform: undefined } as any)) as {
			releases: Array<{ $id: string; name: string; r2Key: string; tags: string[] }>;
		};

		expect(list).toHaveBeenCalledWith({ limit: 100 });
		expect(result.releases[0]).toMatchObject({
			$id: 'release-1',
			name: 'blokserwis-1.0.0.apk',
			r2Key: 'releases/blokserwis-1.0.0.apk',
			tags: ['latest']
		});
	});
});
