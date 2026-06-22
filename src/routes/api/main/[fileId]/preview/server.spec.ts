import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestAdminUnisourceV2 = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	requestAdminUnisourceV2
}));

import { GET } from './+server';

describe('/api/main/[fileId]/preview GET', () => {
	beforeEach(() => requestAdminUnisourceV2.mockReset());

	it('requires authentication', async () => {
		const response = await GET({
			locals: {},
			params: { fileId: 'main-1' },
			url: new URL('http://localhost/api/main/main-1/preview')
		} as any);

		expect(response.status).toBe(401);
	});

	it('forbids basic users', async () => {
		const response = await GET({
			locals: { user: { $id: 'user-1', labels: [] } },
			params: { fileId: 'main-1' },
			url: new URL('http://localhost/api/main/main-1/preview')
		} as any);

		expect(response.status).toBe(403);
		expect(requestAdminUnisourceV2).not.toHaveBeenCalled();
	});

	it('returns a preview URL for plus users', async () => {
		requestAdminUnisourceV2.mockResolvedValue({
			item: {
				preview_url: 'https://r2.example/main.png',
				download_url: 'https://r2.example/main.png?download=1',
				expires_at: 1760000000,
				content_type: 'image/png',
				thumbnail_url: null
			}
		});

		const response = await GET({
			locals: { user: { $id: 'user-1', labels: ['plus'] } },
			params: { fileId: 'main-1' },
			url: new URL('http://localhost/api/main/main-1/preview')
		} as any);

		expect(response.status).toBe(200);
		expect(requestAdminUnisourceV2).toHaveBeenCalledWith(
			expect.anything(),
			'GET',
			'/v2/main/main-1/preview-url'
		);
		expect(await response.json()).toEqual({
			previewUrl: 'https://r2.example/main.png',
			downloadUrl: 'https://r2.example/main.png?download=1',
			expiresAt: 1760000000,
			contentType: 'image/png',
			thumbnailUrl: null
		});
	});
});
