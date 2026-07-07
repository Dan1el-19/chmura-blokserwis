import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UnisourceV2Error } from '@unisource/sdk/v2';

const requestAdminUnisourceV2 = vi.hoisted(() => vi.fn());
const downloadUrl = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	requestAdminUnisourceV2,
	createAdminUnisourceClient: () => ({
		adminFiles: { downloadUrl }
	})
}));

import { GET } from './+server';

describe('/api/main/[fileId]/preview GET', () => {
	beforeEach(() => {
		requestAdminUnisourceV2.mockReset();
		downloadUrl.mockReset();
	});

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

	it('falls back to an Appwrite download URL for main storage previewable files', async () => {
		requestAdminUnisourceV2
			.mockRejectedValueOnce(
				new UnisourceV2Error(
					'Inline preview is not available for this storage destination',
					409,
					'unsupported_preview_destination',
					'req_preview'
				)
			)
			.mockResolvedValueOnce({
				item: {
					id: 'main-1',
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
			locals: { user: { $id: 'user-1', labels: ['plus'] } },
			params: { fileId: 'main-1' },
			url: new URL('http://localhost/api/main/main-1/preview')
		} as any);

		expect(response.status).toBe(200);
		expect(requestAdminUnisourceV2).toHaveBeenNthCalledWith(
			2,
			expect.anything(),
			'GET',
			'/v2/main/main-1'
		);
		expect(downloadUrl).toHaveBeenCalledWith('upload-1');
		expect(await response.json()).toEqual({
			previewUrl: 'https://appwrite.example/v1/storage/buckets/files/files/appwrite-1/download',
			downloadUrl: 'https://appwrite.example/v1/storage/buckets/files/files/appwrite-1/download',
			expiresAt: 1760000900,
			contentType: 'image/jpeg',
			thumbnailUrl: null
		});
	});
});
