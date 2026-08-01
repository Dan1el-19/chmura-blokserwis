import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadComplete = vi.hoisted(() => vi.fn());
const putAppManifest = vi.hoisted(() => vi.fn());
const promoteLatest = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createRequestAdminUnisourceClient: () => ({
		releases: { uploadComplete, putAppManifest }
	})
}));

vi.mock('$lib/server/storage/releases', () => ({ promoteLatest }));
vi.mock('$lib/server/roles', () => ({ getUserRole: () => 'admin' }));

import { POST } from './+server';

function request(body: unknown) {
	return {
		request: new Request('http://localhost/api/releases/complete', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(body)
		}),
		locals: { user: { $id: 'admin-1', labels: ['admin'] } }
	};
}

describe('/api/releases/complete POST', () => {
	beforeEach(() => {
		uploadComplete.mockReset();
		putAppManifest.mockReset();
		promoteLatest.mockReset();
		uploadComplete.mockResolvedValue({ item: { id: 'release-1', upload_status: 'completed' } });
		putAppManifest.mockResolvedValue({ item: { release_id: 'release-1' } });
		promoteLatest.mockResolvedValue(undefined);
	});

	it('completes the upload, persists the app manifest, then promotes the channel', async () => {
		const response = await POST(
			request({
				release_id: 'release-1',
				size: 1024,
				channel: 'beta',
				version_code: 8,
				min_supported_version_code: 7,
				rollout: 25,
				sha256: 'A'.repeat(64),
				certificate_sha256: 'B'.repeat(64)
			}) as never
		);

		expect(response.status).toBe(200);
		expect(uploadComplete).toHaveBeenCalledWith('release-1', 1024);
		expect(putAppManifest).toHaveBeenCalledWith('release-1', {
			version_code: 8,
			min_supported_version_code: 7,
			sha256: 'a'.repeat(64),
			certificate_sha256: 'b'.repeat(64),
			channel: 'beta',
			status: 'published',
			rollout: 25
		});
		expect(promoteLatest).toHaveBeenCalledWith('beta', 'release-1', expect.anything());
	});

	it('rejects an invalid manifest before completing the upload', async () => {
		const response = await POST(
			request({
				release_id: 'release-1',
				size: 1024,
				channel: 'beta',
				version_code: 7,
				min_supported_version_code: 8,
				rollout: 25,
				sha256: 'invalid',
				certificate_sha256: 'B'.repeat(64)
			}) as never
		);

		expect(response.status).toBe(400);
		expect(uploadComplete).not.toHaveBeenCalled();
		expect(putAppManifest).not.toHaveBeenCalled();
		expect(promoteLatest).not.toHaveBeenCalled();
	});
});
