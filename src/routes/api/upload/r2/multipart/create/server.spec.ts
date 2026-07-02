import { beforeEach, describe, expect, it, vi } from 'vitest';

const multipartCreate = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: () => ({
		upload: { multipartCreate }
	})
}));

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { POST } from './+server';

function makeRequest(body: unknown, labels: string[] = ['plus']) {
	const url = new URL('http://localhost/api/upload/r2/multipart/create');
	return {
		locals: { user: { $id: 'user-1', labels } },
		request: new Request(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		platform: undefined
	} as never;
}

describe('/api/upload/r2/multipart/create POST', () => {
	beforeEach(() => {
		multipartCreate.mockReset();
	});

	it('creates a multipart upload', async () => {
		multipartCreate.mockResolvedValue({
			item: { upload_id: 'mp-1', key: 'files/test.bin' }
		});

		const response = await POST(
			makeRequest({
				filename: 'big-file.bin',
				size: 200 * 1024 * 1024,
				mime_type: 'application/octet-stream'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ upload_id: 'mp-1', key: 'files/test.bin' });
		expect(multipartCreate).toHaveBeenCalledWith({
			filename: 'big-file.bin',
			size: 209715200,
			mime_type: 'application/octet-stream',
			is_main_storage: false
		});
	});

	it('returns 401 when user is missing', async () => {
		const url = new URL('http://localhost/api/upload/r2/multipart/create');
		const response = await POST({
			locals: { user: null },
			request: new Request(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					filename: 'f.bin',
					size: 100,
					mime_type: 'application/octet-stream'
				})
			}),
			platform: undefined
		} as never);

		expect(response.status).toBe(401);
	});

	it('returns 403 for basic user with main storage', async () => {
		const response = await POST(
			makeRequest(
				{
					filename: 'big-file.bin',
					size: 200 * 1024 * 1024,
					mime_type: 'application/octet-stream',
					is_main_storage: true
				},
				['basic']
			)
		);

		expect(response.status).toBe(403);
	});

	it('returns 400 for invalid body', async () => {
		const response = await POST(makeRequest({ size: 100, mime_type: 'text/plain' }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('Validation failed');
	});

	it('returns 500 on SDK error', async () => {
		multipartCreate.mockRejectedValue(new Error('Quota exceeded'));

		const response = await POST(
			makeRequest({
				filename: 'big-file.bin',
				size: 200 * 1024 * 1024,
				mime_type: 'application/octet-stream'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error).toBe('Failed to create multipart upload');
	});
});
