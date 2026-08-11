import { beforeEach, describe, expect, it, vi } from 'vitest';

const list = vi.hoisted(() => vi.fn());
const getAppManifest = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createAdminUnisourceClient: () => ({
		releases: {
			list,
			getAppManifest
		}
	}),
	createRequestAdminUnisourceClient: () => ({
		releases: {
			list,
			getAppManifest
		}
	})
}));

import { load } from './+page.server';

describe('/releases load', () => {
	beforeEach(() => {
		list.mockReset();
		getAppManifest.mockReset();
	});

	it('loads releases from UniSource instead of the legacy local Appwrite database', async () => {
		expect.assertions(5);

		list.mockResolvedValue({
			items: [
				{
					id: 'release-1',
					service_id: 'service-1',
					name: 'blokserwis-1.0.0.apk',
					size: 123,
					r2_key: 'releases/blokserwis-1.0.0.apk',
					tags: ['stable', 'latest'],
					notes: 'Initial',
					force_update: false,
					uploaded_by: 'user-1',
					upload_status: 'completed',
					created_at: '2026-05-08T19:00:00.000Z'
				}
			],
			next_cursor: null
		});
		getAppManifest.mockResolvedValue({
			item: {
				version_code: 1,
				min_supported_version_code: 1,
				sha256: 'a'.repeat(64),
				certificate_sha256: 'b'.repeat(64),
				channel: 'stable',
				status: 'published',
				rollout: 100,
				release_id: 'release-1',
				service_id: 'service-1',
				created_at: '2026-05-08T19:00:00.000Z',
				updated_at: '2026-05-08T19:00:00.000Z'
			}
		});

		const result = (await load({
			locals: {
				user: {
					labels: ['admin']
				}
			},
			platform: undefined
		} as any)) as {
			releases: Array<{ $id: string; name: string; r2Key: string; tags: string[] }>;
			releaseUploadDefaults: {
				versionCode: number;
				suggestedVersion: string | null;
				certificateSha256: string;
			};
		};

		expect(list).toHaveBeenCalledTimes(2);
		expect(list).toHaveBeenNthCalledWith(1, { limit: 100 });
		expect(getAppManifest).toHaveBeenCalledWith('release-1');
		expect(result.releases[0]).toMatchObject({
			$id: 'release-1',
			name: 'blokserwis-1.0.0.apk',
			r2Key: 'releases/blokserwis-1.0.0.apk',
			tags: ['stable', 'latest']
		});
		expect(result.releaseUploadDefaults).toMatchObject({
			versionCode: 2,
			suggestedVersion: '1.0.1',
			certificateSha256: 'b'.repeat(64)
		});
	});
});
