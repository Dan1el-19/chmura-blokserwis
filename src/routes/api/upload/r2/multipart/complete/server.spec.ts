import { beforeEach, describe, expect, it, vi } from 'vitest';

const multipartComplete = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: () => ({
		upload: { multipartComplete }
	})
}));

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { POST } from './+server';

function makeRequest(body: unknown) {
	const url = new URL('http://localhost/api/upload/r2/multipart/complete');
	return {
		locals: { user: { $id: 'user-1', labels: ['plus'] } },
		request: new Request(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		platform: undefined
	} as never;
}

describe('/api/upload/r2/multipart/complete POST', () => {
	beforeEach(() => {
		multipartComplete.mockReset();
	});

	it('completes a multipart upload', async () => {
		multipartComplete.mockResolvedValue({
			item: { id: 'file-1', name: 'test.bin', size: 500 }
		});

		const response = await POST(
			makeRequest({
				upload_id: 'mp-1',
				parts: [{ PartNumber: 1, ETag: '"abc123"' }]
			})
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ id: 'file-1', name: 'test.bin', size: 500 });
		expect(multipartComplete).toHaveBeenCalledWith('mp-1', [{ PartNumber: 1, ETag: '"abc123"' }]);
	});

	it('returns 401 when user is missing', async () => {
		const url = new URL('http://localhost/api/upload/r2/multipart/complete');
		const response = await POST({
			locals: { user: null },
			request: new Request(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ upload_id: 'mp-1', parts: [{ PartNumber: 1, ETag: '"abc"' }] })
			}),
			platform: undefined
		} as never);

		expect(response.status).toBe(401);
	});

	it('returns 400 for missing upload_id', async () => {
		const response = await POST(makeRequest({ parts: [{ PartNumber: 1, ETag: '"abc"' }] }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('Validation failed');
	});

	it('returns 400 for empty parts', async () => {
		const response = await POST(makeRequest({ upload_id: 'mp-1', parts: [] }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('Validation failed');
	});

	it('returns 500 on SDK error', async () => {
		multipartComplete.mockRejectedValue(new Error('Upload not found'));

		const response = await POST(
			makeRequest({
				upload_id: 'mp-1',
				parts: [{ PartNumber: 1, ETag: '"abc"' }]
			})
		);
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error).toBe('Failed to complete multipart upload');
	});
});
