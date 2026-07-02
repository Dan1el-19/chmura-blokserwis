import { beforeEach, describe, expect, it, vi } from 'vitest';

const multipartListParts = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: () => ({
		upload: { multipartListParts }
	})
}));

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { GET } from './+server';

function makeRequest(params: Record<string, string>) {
	const url = new URL('http://localhost/api/upload/r2/multipart/list-parts');
	Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
	return {
		locals: { user: { $id: 'user-1', labels: ['plus'] } },
		url,
		platform: undefined
	} as never;
}

describe('/api/upload/r2/multipart/list-parts GET', () => {
	beforeEach(() => {
		multipartListParts.mockReset();
	});

	it('lists uploaded parts', async () => {
		multipartListParts.mockResolvedValue({
			items: [{ PartNumber: 1, ETag: '"abc"', Size: 5242880 }]
		});

		const response = await GET(makeRequest({ upload_id: 'mp-1' }));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.parts).toEqual([{ PartNumber: 1, ETag: '"abc"', Size: 5242880 }]);
		expect(multipartListParts).toHaveBeenCalledWith('mp-1');
	});

	it('returns 401 when user is missing', async () => {
		const url = new URL('http://localhost/api/upload/r2/multipart/list-parts?upload_id=mp-1');
		const response = await GET({
			locals: { user: null },
			url,
			platform: undefined
		} as never);

		expect(response.status).toBe(401);
	});

	it('returns 400 for missing upload_id', async () => {
		const response = await GET(makeRequest({}));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('Validation failed');
	});

	it('returns 500 on SDK error', async () => {
		multipartListParts.mockRejectedValue(new Error('Upload not found'));

		const response = await GET(makeRequest({ upload_id: 'mp-1' }));
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error).toBe('Failed to list uploaded parts');
	});
});
