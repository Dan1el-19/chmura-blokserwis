import { createAdminClient } from '$lib/server/appwrite';
import { ID, Query, type Models } from 'node-appwrite';
import { deleteR2Object } from './r2';
import { getCached, setCache, deleteCache, invalidateByPrefix } from '../cache';
import { CacheKeys } from '../cache/keys';
import { DATABASE } from '$lib/constants';
import type { FolderDocument, ListResult, FolderWithSize } from '$lib/types/storage';
import { logger } from '$lib/server/logger';

const DATABASE_ID = DATABASE.ID;
const FOLDERS_TABLE = DATABASE.TABLES.FOLDERS;
const FILES_TABLE = DATABASE.TABLES.FILES;

export async function getFolder(folderId: string, userId: string): Promise<FolderDocument> {
	const { tablesDB } = createAdminClient();

	const folder = await tablesDB.getRow({
		databaseId: DATABASE_ID,
		tableId: FOLDERS_TABLE,
		rowId: folderId
	});

	if (folder.ownerId !== userId) {
		throw new Error('Access denied: Folder does not belong to user.');
	}

	return folder as unknown as FolderDocument;
}

export async function getFolderMetadata(folderId: string): Promise<FolderDocument> {
	const cacheKey = CacheKeys.folderMetadata(folderId);
	const cached = getCached<FolderDocument>(cacheKey);
	if (cached) return cached;

	const { tablesDB } = createAdminClient();
	const folder = await tablesDB.getRow({
		databaseId: DATABASE_ID,
		tableId: FOLDERS_TABLE,
		rowId: folderId
	});

	const typedFolder = folder as unknown as FolderDocument;
	setCache(cacheKey, typedFolder);
	return typedFolder;
}

export async function createFolder(userId: string, name: string, parentId: string | null = null) {
	const { tablesDB } = createAdminClient();

	let path = '/';
	let parentFolderId = parentId;

	if (parentId) {
		try {
			const parent = await tablesDB.getRow({
				databaseId: DATABASE_ID,
				tableId: FOLDERS_TABLE,
				rowId: parentId
			});
			if (parent.ownerId !== userId) {
				throw new Error('Access denied: Parent folder not owned by user.');
			}
			path = parent.path + parent.$id + '/';
		} catch (e) {
			throw new Error('Parent folder not found.');
		}
	}

	const folder = await tablesDB.createRow({
		databaseId: DATABASE_ID,
		tableId: FOLDERS_TABLE,
		rowId: ID.unique(),
		data: {
			name,
			parentFolderId,
			ownerId: userId,
			path
		}
	});

	invalidateByPrefix(CacheKeys.userFoldersPrefix(userId));

	return folder as unknown as FolderDocument;
}

export async function calculateFolderSize(folderId: string): Promise<number> {
	const cacheKey = CacheKeys.folderSize(folderId);
	const cached = getCached<number>(cacheKey);
	if (cached !== undefined) return cached;

	const { tablesDB } = createAdminClient();

	const files = await tablesDB.listRows({
		databaseId: DATABASE_ID,
		tableId: FILES_TABLE,
		queries: [Query.equal('parentFolderId', folderId)]
	});

	let totalSize = 0;
	for (const file of files.rows) {
		totalSize += (file.size as number) || 0;
	}

	const subfolders = await tablesDB.listRows({
		databaseId: DATABASE_ID,
		tableId: FOLDERS_TABLE,
		queries: [Query.equal('parentFolderId', folderId)]
	});

	for (const subfolder of subfolders.rows) {
		totalSize += await calculateFolderSize(subfolder.$id);
	}

	setCache(cacheKey, totalSize);
	return totalSize;
}

export async function listFolders(
	userId: string,
	parentId: string | null = null
): Promise<ListResult<FolderWithSize>> {
	const cacheKey = CacheKeys.foldersList(userId, parentId);
	const cached = getCached<ListResult<FolderWithSize>>(cacheKey);
	if (cached) return cached;

	const { tablesDB } = createAdminClient();
	const queries = [Query.equal('ownerId', userId)];

	if (parentId) {
		queries.push(Query.equal('parentFolderId', parentId));
	} else {
		queries.push(Query.isNull('parentFolderId'));
	}
	queries.push(Query.orderAsc('name'));

	const result = await tablesDB.listRows({
		databaseId: DATABASE_ID,
		tableId: FOLDERS_TABLE,
		queries
	});

	const foldersWithSize = await Promise.all(
		result.rows.map(async (folder) => {
			const size = await calculateFolderSize(folder.$id);
			return { ...folder, size } as unknown as FolderWithSize;
		})
	);

	const finalResult = {
		total: result.total,
		rows: foldersWithSize
	};
	setCache(cacheKey, finalResult);
	return finalResult;
}

export async function renameFolder(
	folderId: string,
	newName: string,
	userId: string
): Promise<Models.Row> {
	const { tablesDB } = createAdminClient();

	const folder = await tablesDB.getRow({
		databaseId: DATABASE_ID,
		tableId: FOLDERS_TABLE,
		rowId: folderId
	});

	if (folder.ownerId !== userId) {
		throw new Error('Access denied: Folder does not belong to user.');
	}

	const updated = await tablesDB.updateRow({
		databaseId: DATABASE_ID,
		tableId: FOLDERS_TABLE,
		rowId: folderId,
		data: { name: newName }
	});

	deleteCache(CacheKeys.folderMetadata(folderId));
	invalidateByPrefix(CacheKeys.userFoldersPrefix(userId));

	return updated;
}

export async function moveFolder(
	folderId: string,
	targetParentId: string | null,
	userId: string
): Promise<Models.Row> {
	const { tablesDB } = createAdminClient();

	const folder = await tablesDB.getRow({
		databaseId: DATABASE_ID,
		tableId: FOLDERS_TABLE,
		rowId: folderId
	});

	if (folder.ownerId !== userId) {
		throw new Error('Access denied: Folder does not belong to user.');
	}

	if (targetParentId === folderId) {
		throw new Error('Cannot move folder into itself.');
	}

	let newPath = '/';
	if (targetParentId) {
		const targetParent = await tablesDB.getRow({
			databaseId: DATABASE_ID,
			tableId: FOLDERS_TABLE,
			rowId: targetParentId
		});

		if (targetParent.ownerId !== userId) {
			throw new Error('Access denied: Target folder does not belong to user.');
		}

		if ((targetParent.path as string).includes(`/${folderId}/`)) {
			throw new Error('Cannot move folder into its descendant.');
		}

		newPath = targetParent.path + targetParent.$id + '/';
	}

	const updated = await tablesDB.updateRow({
		databaseId: DATABASE_ID,
		tableId: FOLDERS_TABLE,
		rowId: folderId,
		data: {
			parentFolderId: targetParentId,
			path: newPath
		}
	});

	deleteCache(CacheKeys.folderMetadata(folderId));
	invalidateByPrefix(CacheKeys.userFoldersPrefix(userId));

	return updated;
}

export async function deleteFolder(folderId: string, userId: string): Promise<FolderDocument> {
	const { tablesDB } = createAdminClient();

	const folder = await tablesDB.getRow({
		databaseId: DATABASE_ID,
		tableId: FOLDERS_TABLE,
		rowId: folderId
	});

	if (folder.ownerId !== userId) {
		throw new Error('Access denied: Folder does not belong to user.');
	}

	const files = await tablesDB.listRows({
		databaseId: DATABASE_ID,
		tableId: FILES_TABLE,
		queries: [Query.equal('parentFolderId', folderId)]
	});

	for (const file of files.rows) {
		const r2Key = file.r2Key as string;
		await tablesDB.deleteRow({
			databaseId: DATABASE_ID,
			tableId: FILES_TABLE,
			rowId: file.$id
		});
		try {
			await deleteR2Object(r2Key);
		} catch (error) {
			logger.error(`Failed to delete R2 object ${r2Key}:`, error);
		}
		deleteCache(CacheKeys.fileMetadata(file.$id));
	}

	const subfolders = await tablesDB.listRows({
		databaseId: DATABASE_ID,
		tableId: FOLDERS_TABLE,
		queries: [Query.equal('parentFolderId', folderId)]
	});

	for (const subfolder of subfolders.rows) {
		await deleteFolder(subfolder.$id, userId);
	}

	await tablesDB.deleteRow({
		databaseId: DATABASE_ID,
		tableId: FOLDERS_TABLE,
		rowId: folderId
	});

	deleteCache(CacheKeys.folderMetadata(folderId));
	deleteCache(CacheKeys.folderSize(folderId));
	invalidateByPrefix(CacheKeys.userFoldersPrefix(userId));
	invalidateByPrefix(CacheKeys.userFilesPrefix(userId));
	deleteCache(CacheKeys.storageUsage(userId));

	return folder as unknown as FolderDocument;
}
