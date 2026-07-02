import { beforeEach, describe, expect, it, vi } from 'vitest';

const multipartSignPart = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: () => ({
		upload: { multipartSignPart }
	})
}));

vi.mock('$lib/server/storage/r2-url', () => ({
	assertPresignedUrlMatchesR2Config: vi.fn()
}));

vi.mock('$lib/server/runtime-env', () => ({
	requireRuntimeEnv: () => 'configured-value'
}));

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { GET } from './+server';

function makeRequest(params: Record<string, string>) {
	const url = new URL('http://localhost/api/upload/r2/multipart/sign-part');
	Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
	return {
		locals: { user: { $id: 'user-1', labels: ['plus'] } },
		url,
		platform: undefined
	} as never;
}

describe('/api/upload/r2/multipart/sign-part GET', () => {
	beforeEach(() => {
		multipartSignPart.mockReset();
	});

	it('signs a part for upload', async () => {
		multipartSignPart.mockResolvedValue({
			item: { url: 'https://r2.example.com/upload-part', expires: 900 }
		});

		const response = await GET(makeRequest({ upload_id: 'mp-1', part_number: '3' }));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.url).toBe('https://r2.example.com/upload-part');
		expect(body.expires).toBe(900);
		expect(multipartSignPart).toHaveBeenCalledWith('mp-1', 3);
	});

	it('returns 401 when user is missing', async () => {
		const url = new URL(
			'http://localhost/api/upload/r2/multipart/sign-part?upload_id=mp-1&part_number=1'
		);
		const response = await GET({
			locals: { user: null },
			url,
			platform: undefined
		} as never);

		expect(response.status).toBe(401);
	});

	it('returns 400 for missing upload_id', async () => {
		const response = await GET(makeRequest({ part_number: '1' }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('Validation failed');
	});

	it('returns 400 for missing part_number', async () => {
		const response = await GET(makeRequest({ upload_id: 'mp-1' }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('Validation failed');
	});

	it('returns 400 for part_number out of range (0)', async () => {
		const response = await GET(makeRequest({ upload_id: 'mp-1', part_number: '0' }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('Validation failed');
	});

	it('returns 400 for part_number out of range (10001)', async () => {
		const response = await GET(makeRequest({ upload_id: 'mp-1', part_number: '10001' }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('Validation failed');
	});

	it('returns 500 on SDK error', async () => {
		multipartSignPart.mockRejectedValue(new Error('Upload not found'));

		const response = await GET(makeRequest({ upload_id: 'mp-1', part_number: '1' }));
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error).toBe('Failed to sign upload part');
	});
});
