import { beforeEach, describe, expect, it, vi } from 'vitest';

const getReleaseByName = vi.hoisted(() => vi.fn());
const uploadInit = vi.hoisted(() => vi.fn());
const uploadFail = vi.hoisted(() => vi.fn());
const r2Send = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/storage/releases', () => ({
	getReleaseByName
}));

vi.mock('$lib/server/unisource', () => ({
	createAdminUnisourceClient: () => ({
		releases: {
			upload: {
				init: uploadInit,
				fail: uploadFail
			}
		}
	})
}));

vi.mock('$lib/clients/r2', () => ({
	R2: {
		send: r2Send
	}
}));

vi.mock('$lib/server/env', () => ({
	ENV: {
		R2_BUCKET_NAME: 'releases'
	}
}));

vi.mock('@aws-sdk/client-s3', () => ({
	CreateMultipartUploadCommand: class {
		input: unknown;

		constructor(input: unknown) {
			this.input = input;
		}
	}
}));

import { POST } from './+server';

describe('/api/releases/multipart POST', () => {
	beforeEach(() => {
		getReleaseByName.mockReset();
		uploadInit.mockReset();
		uploadFail.mockReset();
		r2Send.mockReset();
	});

	it('marks the release upload as failed when R2 multipart creation fails', async () => {
		getReleaseByName.mockResolvedValue(null);
		uploadInit.mockResolvedValue({
			release_id: 'release-1',
			r2_key: 'releases/blokserwis-1.11.0.apk'
		});
		r2Send.mockRejectedValue(new Error('R2 rejected checksum headers'));

		const response = await POST({
			locals: { user: { $id: 'user-1' } },
			request: new Request('http://localhost/api/releases/multipart', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					filename: 'blokserwis-1.11.0.apk',
					type: 'application/vnd.android.package-archive',
					overwrite: false
				})
			}),
			platform: undefined
		} as never);

		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body).toEqual({ error: 'R2 rejected checksum headers' });
		expect(uploadFail).toHaveBeenCalledWith('release-1');
	});
});
