import { describe, expect, it } from 'vitest';

import {
	mapAdminUserFromUnisource,
	mapFileFromUnisource,
	mapFolderFromUnisource,
	mapPublicFileFromUnisource,
	mapRoleToUnisource,
	mapShareLinkFromUnisource
} from './unisource-mappers';

describe('UniSource mappers', () => {
	it('maps file records into the existing browser file shape', () => {
		const file = mapFileFromUnisource({
			id: 'file-1',
			service_id: 'svc',
			user_id: 'user-1',
			folder_id: null,
			upload_id: 'upload-1',
			filename: 'report.pdf',
			size: 42,
			mime_type: 'application/pdf',
			storage_destination: 'r2',
			is_trashed: false,
			trashed_at: null,
			created_at: 1_700_000_000,
			updated_at: 1_700_000_100
		});

		expect(file).toEqual({
			$id: 'file-1',
			$createdAt: '2023-11-14T22:13:20.000Z',
			$updatedAt: '2023-11-14T22:15:00.000Z',
			$collectionId: 'files',
			$databaseId: 'unisource',
			name: 'report.pdf',
			size: 42,
			mimeType: 'application/pdf',
			r2Key: null,
			bucketId: 'r2',
			ownerId: 'user-1',
			parentFolderId: null,
			isTrashed: false
		});
	});

	it('maps folders into the existing browser folder shape', () => {
		const folder = mapFolderFromUnisource({
			id: 'folder-1',
			service_id: 'svc',
			user_id: 'user-1',
			parent_id: null,
			name: 'Invoices',
			color_tag: null,
			is_trashed: false,
			trashed_at: null,
			created_at: 1_700_000_000,
			updated_at: 1_700_000_100
		});

		expect(folder.name).toBe('Invoices');
		expect(folder.parentFolderId).toBe(null);
		expect(folder.path).toBe('/Invoices');
	});

	it('maps share links without exposing password hashes or auto-delete', () => {
		const share = mapShareLinkFromUnisource({
			id: 'share-1',
			service_id: 'svc',
			file_id: 'file-1',
			user_id: 'user-1',
			slug: 'public-link',
			name: 'Client copy',
			has_password: true,
			expires_at: 1_700_000_000,
			download_count: 2,
			max_downloads: 5,
			is_active: true,
			created_at: 1_699_999_000,
			updated_at: 1_699_999_500
		});

		expect(share).toMatchObject({
			$id: 'share-1',
			fileId: 'file-1',
			folderId: null,
			shareType: 'file',
			token: 'public-link',
			label: 'Client copy',
			autoDelete: false,
			passwordHash: 'protected',
			maxDownloads: 5,
			downloadCount: 2,
			clicks: 2
		});
	});

	it('maps admin users and role updates to the SDK contract', () => {
		const user = mapAdminUserFromUnisource({
			id: 'user-1',
			name: 'Alice',
			email: 'alice@example.com',
			status: true,
			labels: ['plus'],
			role: 'user',
			has_service_access: true,
			max_storage_bytes: null,
			effective_max_storage_bytes: 1024,
			current_used_bytes: 512,
			registration: 1_700_000_000,
			email_verification: true
		});

		expect(user.role).toBe('basic');
		expect(user.storageUsage).toBe(512);
		expect(user.storageLimit).toBe(1024);
		expect(mapRoleToUnisource('basic')).toBe('user');
		expect(mapRoleToUnisource('plus')).toBe('plus');
		expect(mapRoleToUnisource('admin')).toBe('admin');
	});

	it('maps public file responses using the share link expiry, not the short-lived download URL expiry', () => {
		const publicFile = mapPublicFileFromUnisource({
			file_id: 'file-1',
			filename: 'terms.pdf',
			size: 100,
			mime_type: 'application/pdf',
			requires_password: false,
			download_url: 'https://example.com/download',
			url_expires_at: 1_700_000_100,
			link_name: 'Terms',
			link_expires_at: 1_700_010_000
		});

		expect(publicFile).toEqual({
			expired: false,
			fileName: 'terms.pdf',
			fileSize: 100,
			mimeType: 'application/pdf',
			downloadUrl: 'https://example.com/download',
			expiresAt: '2023-11-15T01:00:00.000Z',
			requiresPassword: false,
			limitReached: false,
			remainingDownloads: null
		});
	});

	it('keeps public file responses without a share expiry indefinite even when the download URL expires', () => {
		const publicFile = mapPublicFileFromUnisource({
			file_id: 'file-1',
			filename: 'terms.pdf',
			size: 100,
			mime_type: 'application/pdf',
			requires_password: false,
			download_url: 'https://example.com/download',
			url_expires_at: 1_700_000_100,
			link_name: 'Terms',
			link_expires_at: null
		});

		expect(publicFile.expiresAt).toBe(null);
	});
});
