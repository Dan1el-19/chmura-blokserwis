import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createShare, listShares } from '$lib/server/storage/shares';
import { getFile, getFileMetadata } from '$lib/server/storage/files';
import { getFolder, getFolderMetadata } from '$lib/server/storage/folders';
import { getUserRole, MAIN_STORAGE_OWNER_ID, type UserPreferences } from '$lib/server/roles';
import type { ShareType, FileDocument, FolderDocument } from '$lib/types/storage';
import type { Models } from 'node-appwrite';

// Helper function to get file with main-storage access support
async function getFileWithAccess(fileId: string, user: Models.User<UserPreferences>): Promise<{ file: FileDocument; effectiveUserId: string }> {
	const role = getUserRole(user);
	const file = await getFileMetadata(fileId);
	
	// Owner has access
	if (file.ownerId === user.$id) {
		return { file, effectiveUserId: user.$id };
	}
	
	// Admin and plus users can access main-storage files
	if (file.ownerId === MAIN_STORAGE_OWNER_ID && role !== 'basic') {
		return { file, effectiveUserId: MAIN_STORAGE_OWNER_ID };
	}
	
	throw new Error('Access denied: File does not belong to user.');
}

// Helper function to get folder with main-storage access support
async function getFolderWithAccess(folderId: string, user: Models.User<UserPreferences>): Promise<{ folder: FolderDocument; effectiveUserId: string }> {
	const role = getUserRole(user);
	const folder = await getFolderMetadata(folderId);
	
	// Owner has access
	if (folder.ownerId === user.$id) {
		return { folder, effectiveUserId: user.$id };
	}
	
	// Admin and plus users can access main-storage folders
	if (folder.ownerId === MAIN_STORAGE_OWNER_ID && role !== 'basic') {
		return { folder, effectiveUserId: MAIN_STORAGE_OWNER_ID };
	}
	
	throw new Error('Access denied: Folder does not belong to user.');
}

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const fileId = url.searchParams.get('fileId');
	const folderId = url.searchParams.get('folderId');

	if (!fileId && !folderId) {
		return json({ error: 'Missing fileId or folderId' }, { status: 400 });
	}

	try {
		if (fileId) {
			await getFileWithAccess(fileId, locals.user as Models.User<UserPreferences>);
			const shares = await listShares({ fileId });
			return json(shares);
		} else if (folderId) {
			await getFolderWithAccess(folderId, locals.user as Models.User<UserPreferences>);
			const shares = await listShares({ folderId });
			return json(shares);
		}

		return json({ error: 'Invalid request' }, { status: 400 });
	} catch (e) {
		console.error('List Shares Error:', e);
		return json({ error: 'Failed to list shares' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json();
		const {
			fileId,
			folderId,
			shareType,
			label,
			expiresAt,
			autoDelete,
			customSlug,
			password,
			maxDownloads
		} = body;

		if (!fileId && !folderId) {
			return json({ error: 'Missing fileId or folderId' }, { status: 400 });
		}

		if (fileId && folderId) {
			return json({ error: 'Cannot share both file and folder at once' }, { status: 400 });
		}

		let name: string;

		if (fileId) {
			const { file } = await getFileWithAccess(fileId, locals.user as Models.User<UserPreferences>);
			name = file.name;
		} else {
			const { folder } = await getFolderWithAccess(folderId, locals.user as Models.User<UserPreferences>);
			name = folder.name;
		}

		const share = await createShare(locals.user.$id, name, {
			fileId: fileId || null,
			folderId: folderId || null,
			shareType: shareType as ShareType,
			label,
			expiresAt,
			autoDelete,
			customSlug,
			password,
			maxDownloads
		});

		return json(share);
	} catch (e: any) {
		console.error('Create Share Error:', e);
		if (e.message?.includes('already taken')) {
			return json({ error: e.message }, { status: 409 });
		}
		if (e.message?.includes('Access denied')) {
			return json({ error: 'Access denied' }, { status: 403 });
		}
		return json({ error: 'Failed to create share' }, { status: 500 });
	}
};
