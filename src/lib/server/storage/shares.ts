import { createAdminClient } from '$lib/server/appwrite';
import { DATABASE } from '$lib/constants';
import { ID, Query } from 'node-appwrite';
import type { FileShare, ShareType } from '$lib/types/storage';
import { deleteFile, getFile } from './files';
import { deleteFolder } from './folders';
import bcrypt from 'bcrypt';

function randomHash(length: number = 6): string {
	const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
	let result = '';
	for (let i = 0; i < length; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

const SHARES_TABLE = DATABASE.TABLES.FILE_SHARES;
const DATABASE_ID = DATABASE.ID;

function slugify(text: string) {
	return text
		.toString()
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/\s+/g, '-')
		.replace(/[^\w\-]+/g, '')
		.replace(/\-\-+/g, '-')
		.replace(/^-+/, '')
		.replace(/-+$/, '');
}

export interface CreateShareOptions {
	fileId?: string | null;
	folderId?: string | null;
	shareType?: ShareType;
	label?: string;
	expiresAt?: string;
	autoDelete?: boolean;
	customSlug?: string;
	password?: string;
	maxDownloads?: number;
}

export async function createShare(
	userId: string,
	name: string,
	options: CreateShareOptions
): Promise<FileShare> {
	const { tablesDB } = createAdminClient();

	// XOR validation: exactly one of fileId or folderId must be provided
	const hasFile = options.fileId && options.fileId !== null;
	const hasFolder = options.folderId && options.folderId !== null;

	if (hasFile === hasFolder) {
		throw new Error('Exactly one of fileId or folderId must be provided.');
	}

	// Determine shareType
	let shareType: ShareType;
	if (hasFile) {
		shareType = 'file';
	} else {
		shareType = options.shareType === 'zip' ? 'zip' : 'folder';
	}

	// Generate token
	let token = '';
	if (options.customSlug) {
		if (!/^[a-z0-9-]+$/.test(options.customSlug)) {
			throw new Error('Invalid slug format. Use only lowercase letters, numbers, and hyphens.');
		}
		token = slugify(options.customSlug);
		const existing = await tablesDB.listRows({
			databaseId: DATABASE_ID,
			tableId: SHARES_TABLE,
			queries: [Query.equal('token', token)]
		});
		if (existing.total > 0) {
			throw new Error('This custom URL is already taken.');
		}
	} else {
		const baseName = name.includes('.') ? name.split('.').slice(0, -1).join('.') : name;
		const baseSlug = slugify(baseName) || 'share';
		const hash = randomHash(6);
		token = `${baseSlug}-${hash}`;

		const existing = await tablesDB.listRows({
			databaseId: DATABASE_ID,
			tableId: SHARES_TABLE,
			queries: [Query.equal('token', token)]
		});
		if (existing.total > 0) {
			token = `${baseSlug}-${randomHash(8)}`;
		}
	}

	let passwordHash: string | null = null;
	if (options.password) {
		passwordHash = await bcrypt.hash(options.password, 12);
	}

	const share = await tablesDB.createRow({
		databaseId: DATABASE_ID,
		tableId: SHARES_TABLE,
		rowId: ID.unique(),
		data: {
			fileId: options.fileId || null,
			folderId: options.folderId || null,
			shareType,
			token,
			label: options.label || null,
			expiresAt: options.expiresAt || null,
			autoDelete: options.autoDelete || false,
			createdBy: userId,
			clicks: 0,
			passwordHash,
			maxDownloads: options.maxDownloads || null,
			downloadCount: 0
		}
	});

	return share as unknown as FileShare;
}

export async function getShareByToken(token: string): Promise<FileShare | null> {
	const result = await getShareByTokenWithExpiredCheck(token);
	return result.share;
}

export async function getShareByTokenWithExpiredCheck(
	token: string
): Promise<{ share: FileShare | null; expired: boolean }> {
	const { tablesDB } = createAdminClient();

	const result = await tablesDB.listRows({
		databaseId: DATABASE_ID,
		tableId: SHARES_TABLE,
		queries: [Query.equal('token', token)]
	});

	if (result.total === 0) return { share: null, expired: false };
	const share = result.rows[0] as unknown as FileShare;

	if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
		if (share.autoDelete) {
			try {
				if (share.fileId) {
					const file = await getFile(share.fileId, share.createdBy).catch(() => null);
					if (file) {
						await deleteFile(share.fileId as string, share.createdBy);
					}
				} else if (share.folderId) {
					await deleteFolder(share.folderId, share.createdBy).catch(() => null);
				}
				await deleteShare(share.$id);
			} catch (e) {
				console.error('Failed to auto-delete:', e);
			}
		}
		return { share: null, expired: true };
	}

	tablesDB
		.updateRow({
			databaseId: DATABASE_ID,
			tableId: SHARES_TABLE,
			rowId: share.$id,
			data: { clicks: share.clicks + 1 }
		})
		.catch((e) => console.error('Failed to increment clicks:', e));

	return { share, expired: false };
}

export async function listShares(options: { fileId?: string; folderId?: string }): Promise<FileShare[]> {
	const { tablesDB } = createAdminClient();
	const queries = [];

	if (options.fileId) {
		queries.push(Query.equal('fileId', options.fileId));
	} else if (options.folderId) {
		queries.push(Query.equal('folderId', options.folderId));
	} else {
		throw new Error('Either fileId or folderId must be provided.');
	}

	queries.push(Query.orderDesc('$createdAt'));

	const result = await tablesDB.listRows({
		databaseId: DATABASE_ID,
		tableId: SHARES_TABLE,
		queries
	});
	return result.rows as unknown as FileShare[];
}

export async function deleteShare(shareId: string): Promise<void> {
	const { tablesDB } = createAdminClient();
	await tablesDB.deleteRow({
		databaseId: DATABASE_ID,
		tableId: SHARES_TABLE,
		rowId: shareId
	});
}

export async function getShareById(shareId: string): Promise<FileShare | null> {
	const { tablesDB } = createAdminClient();
	try {
		const share = await tablesDB.getRow({
			databaseId: DATABASE_ID,
			tableId: SHARES_TABLE,
			rowId: shareId
		});
		return share as unknown as FileShare;
	} catch (e: any) {
		if (e.code === 404) return null;
		throw e;
	}
}

export async function verifySharePassword(share: FileShare, password: string): Promise<boolean> {
	if (!share.passwordHash) return true;
	return bcrypt.compare(password, share.passwordHash);
}

export async function incrementDownloadCount(shareId: string): Promise<void> {
	const { tablesDB } = createAdminClient();
	const share = await getShareById(shareId);
	if (!share) return;

	await tablesDB.updateRow({
		databaseId: DATABASE_ID,
		tableId: SHARES_TABLE,
		rowId: shareId,
		data: { downloadCount: share.downloadCount + 1 }
	});
}

export function isDownloadLimitReached(share: FileShare): boolean {
	if (!share.maxDownloads) return false;
	return share.downloadCount >= share.maxDownloads;
}
