import { createAdminClient } from '$lib/server/appwrite';
import { ID, Query } from 'node-appwrite';
import { deleteR2Object, getDownloadUrl } from './r2';
import { DATABASE } from '$lib/constants';
import type {
	ReleaseDocument,
	ReleaseMetadata,
	ParsedRelease,
	ReleaseDownloadResult
} from '$lib/types/releases';
import { logger } from '$lib/server/logger';

const DATABASE_ID = DATABASE.ID;
const RELEASES_TABLE = DATABASE.TABLES.RELEASES;

function parseRelease(doc: ReleaseDocument): ParsedRelease {
	return {
		...doc,
		tags: doc.tags ? JSON.parse(doc.tags) : []
	};
}

export async function createRelease(metadata: ReleaseMetadata): Promise<ParsedRelease> {
	const { tablesDB } = createAdminClient();

	const data = {
		name: metadata.name,
		size: metadata.size,
		r2Key: metadata.r2Key,
		tags: metadata.tags ? JSON.stringify(metadata.tags) : null,
		uploadedBy: metadata.uploadedBy,
		notes: metadata.notes || null
	};

	const release = await tablesDB.createRow({
		databaseId: DATABASE_ID,
		tableId: RELEASES_TABLE,
		rowId: ID.unique(),
		data
	});

	return parseRelease(release as unknown as ReleaseDocument);
}

export async function listReleases(): Promise<ParsedRelease[]> {
	const { tablesDB } = createAdminClient();

	const result = await tablesDB.listRows({
		databaseId: DATABASE_ID,
		tableId: RELEASES_TABLE,
		queries: [Query.orderDesc('$createdAt'), Query.limit(100)]
	});

	return result.rows.map((row) => parseRelease(row as unknown as ReleaseDocument));
}

export async function getRelease(releaseId: string): Promise<ParsedRelease> {
	const { tablesDB } = createAdminClient();

	const release = await tablesDB.getRow({
		databaseId: DATABASE_ID,
		tableId: RELEASES_TABLE,
		rowId: releaseId
	});

	return parseRelease(release as unknown as ReleaseDocument);
}

export async function getReleaseByName(name: string): Promise<ParsedRelease | null> {
	const { tablesDB } = createAdminClient();

	const result = await tablesDB.listRows({
		databaseId: DATABASE_ID,
		tableId: RELEASES_TABLE,
		queries: [Query.equal('name', name), Query.limit(1)]
	});

	if (result.rows.length === 0) {
		return null;
	}

	return parseRelease(result.rows[0] as unknown as ReleaseDocument);
}

export async function updateRelease(
	releaseId: string,
	data: { tags?: string[]; notes?: string }
): Promise<ParsedRelease> {
	const { tablesDB } = createAdminClient();

	const updateData: Record<string, unknown> = {};

	if (data.tags !== undefined) {
		updateData.tags = JSON.stringify(data.tags);
	}

	if (data.notes !== undefined) {
		updateData.notes = data.notes || null;
	}

	const release = await tablesDB.updateRow({
		databaseId: DATABASE_ID,
		tableId: RELEASES_TABLE,
		rowId: releaseId,
		data: updateData
	});

	return parseRelease(release as unknown as ReleaseDocument);
}

export async function deleteRelease(releaseId: string): Promise<void> {
	const { tablesDB } = createAdminClient();

	const release = await tablesDB.getRow({
		databaseId: DATABASE_ID,
		tableId: RELEASES_TABLE,
		rowId: releaseId
	});

	const r2Key = release.r2Key as string;

	await tablesDB.deleteRow({
		databaseId: DATABASE_ID,
		tableId: RELEASES_TABLE,
		rowId: releaseId
	});

	try {
		await deleteR2Object(r2Key);
	} catch (error) {
		logger.error(`Failed to delete R2 object ${r2Key}:`, error);
	}
}

export async function getReleaseDownloadUrl(releaseId: string): Promise<ReleaseDownloadResult> {
	const release = await getRelease(releaseId);
	const url = await getDownloadUrl(release.r2Key, release.name);
	return { release, url };
}
