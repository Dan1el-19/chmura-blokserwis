import { createAdminClient } from '$lib/server/appwrite';
import { DATABASE } from '$lib/constants';
import { ID, Query } from 'node-appwrite';
import { nanoid } from 'nanoid';
import type { FileShare } from '$lib/types/storage';
import { deleteFile, getFile } from './files';

const SHARES_TABLE = DATABASE.TABLES.FILE_SHARES;
const DATABASE_ID = DATABASE.ID;

function slugify(text: string) {
	return text
		.toString()
		.toLowerCase()
		.normalize('NFD') // Separate accents
		.replace(/[\u0300-\u036f]/g, '') // Remove accents
		.replace(/\s+/g, '-')
		.replace(/[^\w\-]+/g, '')
		.replace(/\-\-+/g, '-')
		.replace(/^-+/, '')
		.replace(/-+$/, '');
}

export async function createShare(
	fileId: string,
	userId: string,
	filename: string,
	options: {
		label?: string;
		expiresAt?: string;
		autoDelete?: boolean;
		customSlug?: string;
	}
): Promise<FileShare> {
	const { tablesDB } = createAdminClient();

	let token = '';

	if (options.customSlug) {
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
		// Default: filename-randomhash
		const baseSlug = slugify(filename.split('.').slice(0, -1).join('.'));
		const hash = nanoid(6);
		token = `${baseSlug}-${hash}`;

		// Ensure uniqueness (rare edge case)
		const existing = await tablesDB.listRows({
			databaseId: DATABASE_ID,
			tableId: SHARES_TABLE,
			queries: [Query.equal('token', token)]
		});
		if (existing.total > 0) {
			token = `${baseSlug}-${nanoid(8)}`;
		}
	}

	const share = await tablesDB.createRow({
		databaseId: DATABASE_ID,
		tableId: SHARES_TABLE,
		rowId: ID.unique(),
		data: {
			fileId,
			token,
			label: options.label || null,
			expiresAt: options.expiresAt || null,
			autoDelete: options.autoDelete || false,
			createdBy: userId,
			clicks: 0
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

	// Check Expiry
	if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
		if (share.autoDelete) {
			try {
				const file = await getFile(share.fileId, share.createdBy).catch(() => null);
				if (file) {
					await deleteFile(share.fileId, share.createdBy);
				}
				await deleteShare(share.$id);
			} catch (e) {
				console.error('Failed to auto-delete file:', e);
			}
		}
		return { share: null, expired: true };
	}

	// Increment clicks asynchronously
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

export async function listShares(fileId: string): Promise<FileShare[]> {
	const { tablesDB } = createAdminClient();
	const result = await tablesDB.listRows({
		databaseId: DATABASE_ID,
		tableId: SHARES_TABLE,
		queries: [Query.equal('fileId', fileId), Query.orderDesc('$createdAt')]
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
