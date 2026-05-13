import { beforeEach, describe, expect, it, vi } from 'vitest';

const getReleaseByName = vi.hoisted(() => vi.fn());
const multipartCreate = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/storage/releases', () => ({
	getReleaseByName
}));

vi.mock('$lib/server/unisource', () => ({
	createAdminUnisourceClient: () => ({
		releases: {
			upload: {
				multipart: {
					create: multipartCreate
				}
			}
		}
	})
}));

import { POST } from './+server';

function makeRequest(body: unknown) {
	return {
		locals: { user: { $id: 'user-1' } },
		request: new Request('http://localhost/api/releases/multipart', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		platform: undefined
	} as never;
}

describe('/api/releases/multipart POST', () => {
	beforeEach(() => {
		getReleaseByName.mockReset();
		multipartCreate.mockReset();
	});

	it('returns Uppy-compatible payload when SDK multipart create succeeds', async () => {
		getReleaseByName.mockResolvedValue(null);
		multipartCreate.mockResolvedValue({
			upload_id: 'release-1',
			r2_upload_id: 'r2-multipart-id',
			key: 'releases/blokserwis-1.11.0.apk',
			bucket: 'chmura-blokserwis',
			expires_at: 1_700_000_000
		});

		const response = await POST(
			makeRequest({
				filename: 'blokserwis-1.11.0.apk',
				type: 'application/vnd.android.package-archive',
				overwrite: false
			})
		);

		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({
			key: 'releases/blokserwis-1.11.0.apk',
			uploadId: 'release-1',
			release_id: 'release-1',
			existingRelease: null
		});
		expect(multipartCreate).toHaveBeenCalledWith({
			name: 'blokserwis-1.11.0.apk',
			filename: 'blokserwis-1.11.0.apk',
			mime_type: 'application/vnd.android.package-archive',
			tags: [],
			notes: null,
			force_update: false
		});
	});

	it('returns 409 conflict when a release already exists and overwrite is false', async () => {
		getReleaseByName.mockResolvedValue({ id: 'existing', name: 'blokserwis-1.11.0.apk' });

		const response = await POST(
			makeRequest({
				filename: 'blokserwis-1.11.0.apk',
				type: 'application/vnd.android.package-archive',
				overwrite: false
			})
		);

		expect(response.status).toBe(409);
		expect(multipartCreate).not.toHaveBeenCalled();
	});

	it('surfaces SDK errors from multipart create', async () => {
		getReleaseByName.mockResolvedValue(null);
		multipartCreate.mockRejectedValue(new Error('UniSource backend rejected the request'));

		const response = await POST(
			makeRequest({
				filename: 'blokserwis-1.11.0.apk',
				type: 'application/vnd.android.package-archive',
				overwrite: false
			})
		);

		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body).toEqual({ error: 'UniSource backend rejected the request' });
	});
});
