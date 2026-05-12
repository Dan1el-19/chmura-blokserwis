import { beforeEach, describe, expect, it, vi } from 'vitest';

const getRelease = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/storage/releases', () => ({
	getRelease,
	updateRelease: vi.fn(),
	deleteRelease: vi.fn()
}));

import { GET } from './+server';

describe('/api/releases/[releaseId] GET', () => {
	beforeEach(() => {
		getRelease.mockReset();
	});

	it('returns release metadata without creating a download URL', async () => {
		getRelease.mockResolvedValue({
			$id: 'rel-1',
			$createdAt: '2026-05-11T12:00:00.000Z',
			name: 'blokserwis.apk',
			size: 123,
			r2_key: 'releases/chmura-blokserwis/blokserwis.apk',
			r2Key: 'releases/chmura-blokserwis/blokserwis.apk',
			tags: [],
			notes: null,
			force_update: false,
			uploaded_by: 'system',
			upload_status: 'completed'
		});

		const response = await GET({
			params: { releaseId: 'rel-1' },
			platform: undefined
		} as never);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(getRelease).toHaveBeenCalledWith('rel-1', expect.anything());
		expect(body).toEqual({
			release: expect.objectContaining({
				$id: 'rel-1',
				r2_key: 'releases/chmura-blokserwis/blokserwis.apk'
			})
		});
		expect(body.downloadUrl).toBeUndefined();
	});
});
