import type {
	AdminUser,
	FileRecord,
	Folder,
	PublicFileAccessResponse,
	PublicFileLockedResponse,
	ReleaseDTO,
	ShareLink
} from '@unisource/sdk';

import type { FileDocument, FileShare, FolderDocument } from '$lib/types/storage';
import type { ParsedRelease } from '$lib/types/releases';
import type { UserRole } from './roles';

const DATABASE_ID = 'unisource';

function toIso(timestamp: number | null | undefined): string | null {
	if (!timestamp) return null;
	return new Date(timestamp * 1000).toISOString();
}

export function mapFileFromUnisource(file: FileRecord): FileDocument & { isTrashed: boolean } {
	return {
		$id: file.id,
		$createdAt: toIso(file.created_at) ?? new Date(0).toISOString(),
		$updatedAt: toIso(file.updated_at) ?? new Date(0).toISOString(),
		$collectionId: 'files',
		$databaseId: DATABASE_ID,
		name: file.filename,
		size: file.size,
		mimeType: file.mime_type,
		r2Key: null,
		bucketId: file.storage_destination,
		ownerId: file.user_id,
		parentFolderId: file.folder_id,
		isTrashed: file.is_trashed
	};
}

export function mapFolderFromUnisource(folder: Folder): FolderDocument & { isTrashed: boolean } {
	return {
		$id: folder.id,
		$createdAt: toIso(folder.created_at) ?? new Date(0).toISOString(),
		$updatedAt: toIso(folder.updated_at) ?? new Date(0).toISOString(),
		$collectionId: 'folders',
		$databaseId: DATABASE_ID,
		name: folder.name,
		ownerId: folder.user_id,
		parentFolderId: folder.parent_id,
		path: `/${folder.name}`,
		isTrashed: folder.is_trashed
	};
}

export function mapShareLinkFromUnisource(link: ShareLink): FileShare {
	return {
		$id: link.id,
		$createdAt: toIso(link.created_at) ?? new Date(0).toISOString(),
		$updatedAt: toIso(link.updated_at) ?? new Date(0).toISOString(),
		$collectionId: 'share_links',
		$databaseId: DATABASE_ID,
		fileId: link.file_id,
		folderId: null,
		shareType: 'file',
		token: link.slug,
		label: link.name,
		expiresAt: toIso(link.expires_at),
		autoDelete: false,
		clicks: link.download_count,
		createdBy: link.user_id,
		passwordHash: link.has_password ? 'protected' : null,
		maxDownloads: link.max_downloads,
		downloadCount: link.download_count
	};
}

export function mapRoleFromUnisource(role: string): UserRole {
	if (role === 'admin') return 'admin';
	if (role === 'plus') return 'plus';
	return 'basic';
}

export function mapRoleToUnisource(role: UserRole): 'user' | 'plus' | 'admin' {
	if (role === 'basic') return 'user';
	return role;
}

export function mapAdminUserFromUnisource(user: AdminUser) {
	return {
		$id: user.id,
		email: user.email,
		name: user.name,
		$createdAt: toIso(user.registration) ?? new Date(0).toISOString(),
		role: mapRoleFromUnisource(user.role),
		storageUsage: user.current_used_bytes,
		storageLimit: user.effective_max_storage_bytes,
		customLimit: user.max_storage_bytes,
		status: user.status,
		labels: user.labels,
		emailVerification: user.email_verification,
		hasServiceAccess: user.has_service_access
	};
}

export function mapReleaseFromUnisource(release: ReleaseDTO): ParsedRelease {
	return {
		$id: release.id,
		$createdAt: release.created_at,
		$updatedAt: release.created_at,
		$collectionId: 'releases',
		$databaseId: DATABASE_ID,
		name: release.name,
		size: release.size,
		r2Key: release.r2_key,
		tags: release.tags,
		uploadedBy: release.uploaded_by,
		notes: release.notes
	};
}

export function mapPublicFileFromUnisource(
	response: PublicFileAccessResponse | PublicFileLockedResponse
) {
	const base = {
		expired: false,
		fileName: response.filename,
		fileSize: response.size,
		mimeType: response.mime_type,
		requiresPassword: response.requires_password,
		limitReached: false,
		remainingDownloads: null as number | null
	};

	if (response.requires_password) {
		return {
			...base,
			downloadUrl: null,
			expiresAt: null
		};
	}

	return {
		...base,
		downloadUrl: response.download_url,
		expiresAt: toIso(response.link_expires_at)
	};
}
