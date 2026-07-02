import { beforeEach, describe, expect, it, vi } from 'vitest';

const multipartAbort = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: () => ({
		upload: { multipartAbort }
	})
}));

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { DELETE } from './+server';

function makeRequest(body: unknown) {
	const url = new URL('http://localhost/api/upload/r2/multipart/abort');
	return {
		locals: { user: { $id: 'user-1', labels: ['plus'] } },
		request: new Request(url, {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		platform: undefined
	} as never;
}

describe('/api/upload/r2/multipart/abort DELETE', () => {
	beforeEach(() => {
		multipartAbort.mockReset();
	});

	it('aborts a multipart upload', async () => {
		multipartAbort.mockResolvedValue({
			item: { success: true }
		});

		const response = await DELETE(makeRequest({ upload_id: 'mp-1' }));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ success: true });
		expect(multipartAbort).toHaveBeenCalledWith('mp-1');
	});

	it('returns 401 when user is missing', async () => {
		const url = new URL('http://localhost/api/upload/r2/multipart/abort');
		const response = await DELETE({
			locals: { user: null },
			request: new Request(url, {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ upload_id: 'mp-1' })
			}),
			platform: undefined
		} as never);

		expect(response.status).toBe(401);
	});

	it('returns 400 for missing upload_id', async () => {
		const response = await DELETE(makeRequest({}));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('Validation failed');
	});

	it('returns 500 on SDK error', async () => {
		multipartAbort.mockRejectedValue(new Error('Upload not found'));

		const response = await DELETE(makeRequest({ upload_id: 'mp-1' }));
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error).toBe('Failed to abort multipart upload');
	});
});
