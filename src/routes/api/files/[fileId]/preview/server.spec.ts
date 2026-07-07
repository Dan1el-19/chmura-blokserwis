import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnisourceV2Error } from '@unisource/sdk/v2';

const previewUrl = vi.hoisted(() => vi.fn());
const get = vi.hoisted(() => vi.fn());
const downloadUrl = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: () => ({
		userFiles: { previewUrl, get, downloadUrl }
	})
}));

import { GET } from './+server';

describe('/api/files/[fileId]/preview GET', () => {
	beforeEach(() => {
		previewUrl.mockReset();
		get.mockReset();
		downloadUrl.mockReset();
	});

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

	it('falls back to an Appwrite download URL for inline previewable files', async () => {
		previewUrl.mockRejectedValue(
			new UnisourceV2Error(
				'Inline preview is not available for this storage destination',
				409,
				'unsupported_preview_destination',
				'req_preview'
			)
		);
		get.mockResolvedValue({
			item: {
				id: 'file-1',
				service_id: 'svc-1',
				user_id: 'user-1',
				folder_id: null,
				upload_id: 'upload-1',
				filename: 'alarm.jpg',
				size: 1024,
				mime_type: 'image/jpeg',
				storage_destination: 'appwrite',
				is_trashed: false,
				trashed_at: null,
				created_at: 1760000000,
				updated_at: 1760000000
			}
		});
		downloadUrl.mockResolvedValue({
			item: {
				download_url: 'https://appwrite.example/v1/storage/buckets/files/files/appwrite-1/download',
				expires_at: 1760000900
			}
		});

		const response = await GET({
			locals: { user: { $id: 'user-1', labels: [] } },
			params: { fileId: 'file-1' },
			url: new URL('http://localhost/api/files/file-1/preview?targetUserId=user-2')
		} as any);

		expect(response.status).toBe(200);
		expect(get).toHaveBeenCalledWith('file-1', undefined, { asUser: 'user-2' });
		expect(downloadUrl).toHaveBeenCalledWith('file-1', undefined, { asUser: 'user-2' });
		expect(await response.json()).toEqual({
			previewUrl: 'https://appwrite.example/v1/storage/buckets/files/files/appwrite-1/download',
			downloadUrl: 'https://appwrite.example/v1/storage/buckets/files/files/appwrite-1/download',
			expiresAt: 1760000900,
			contentType: 'image/jpeg',
			thumbnailUrl: null
		});
	});
});
