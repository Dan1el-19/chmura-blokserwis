import { beforeEach, describe, expect, it, vi } from 'vitest';

const previewUrl = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: () => ({
		userFiles: { previewUrl }
	})
}));

import { GET } from './+server';

describe('/api/files/[fileId]/preview GET', () => {
	beforeEach(() => previewUrl.mockReset());

	it('requires authentication', async () => {
		const response = await GET({
			locals: {},
			params: { fileId: 'file-1' },
			url: new URL('http://localhost/api/files/file-1/preview')
		} as any);

		expect(response.status).toBe(401);
	});

	it('returns a preview URL for the authenticated user', async () => {
		previewUrl.mockResolvedValue({
			item: {
				preview_url: 'https://r2.example/photo.png',
				download_url: 'https://r2.example/photo.png?download=1',
				expires_at: 1760000000,
				content_type: 'image/png',
				thumbnail_url: 'https://r2.example/thumb.png'
			}
		});

		const response = await GET({
			locals: { user: { $id: 'user-1', labels: [] } },
			params: { fileId: 'file-1' },
			url: new URL('http://localhost/api/files/file-1/preview?targetUserId=user-2')
		} as any);

		expect(response.status).toBe(200);
		expect(previewUrl).toHaveBeenCalledWith('file-1', undefined, { asUser: 'user-2' });
		expect(await response.json()).toEqual({
			previewUrl: 'https://r2.example/photo.png',
			downloadUrl: 'https://r2.example/photo.png?download=1',
			expiresAt: 1760000000,
			contentType: 'image/png',
			thumbnailUrl: 'https://r2.example/thumb.png'
		});
	});
});
