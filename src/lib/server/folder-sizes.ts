import type { UnisourceV2Client } from '@unisource/sdk/v2';

import { unwrapList } from './unisource-v2-contract';

type FolderNode = {
	id: string;
	parent_id: string | null;
};

type FileNode = {
	folder_id: string | null;
	size: number;
};

type FolderSizeClient = Pick<UnisourceV2Client, 'folders' | 'myFiles'>;

type FolderSizeQueryOptions = {
	asUser?: string;
};

/**
 * Totals every file contained in a folder and its descendant folders. Files at
 * the storage root are intentionally excluded because they have no folder to
 * contribute to.
 */
export function calculateFolderSizes(
	folders: readonly FolderNode[],
	files: readonly FileNode[]
): Map<string, number> {
	const children = new Map<string, string[]>();
	const directSizes = new Map<string, number>();

	for (const folder of folders) {
		children.set(folder.id, children.get(folder.id) ?? []);
		if (folder.parent_id) {
			const siblings = children.get(folder.parent_id) ?? [];
			siblings.push(folder.id);
			children.set(folder.parent_id, siblings);
		}
	}

	for (const file of files) {
		if (!file.folder_id) continue;
		directSizes.set(file.folder_id, (directSizes.get(file.folder_id) ?? 0) + file.size);
	}

	const totals = new Map<string, number>();
	const visiting = new Set<string>();

	function totalFor(folderId: string): number {
		const cached = totals.get(folderId);
		if (cached !== undefined) return cached;

		// A corrupt cyclic hierarchy must not make the page load recurse forever.
		if (visiting.has(folderId)) return 0;
		visiting.add(folderId);

		let total = directSizes.get(folderId) ?? 0;
		for (const childId of children.get(folderId) ?? []) {
			total += totalFor(childId);
		}

		visiting.delete(folderId);
		totals.set(folderId, total);
		return total;
	}

	for (const folder of folders) {
		totalFor(folder.id);
	}

	return totals;
}

async function listAll<T>(fetchPage: (cursor?: string) => Promise<unknown>): Promise<T[]> {
	const items: T[] = [];
	let cursor: string | undefined;

	do {
		const page = unwrapList<T>(await fetchPage(cursor));
		items.push(...page.items);
		cursor = page.nextCursor ?? undefined;
	} while (cursor);

	return items;
}

/** Fetches the descendants and files needed to calculate the supplied active folders. */
export async function getActiveFolderSizes(
	client: FolderSizeClient,
	rootFolders: readonly FolderNode[],
	options: FolderSizeQueryOptions = {}
): Promise<Map<string, number>> {
	const folders = [...rootFolders];
	const files: FileNode[] = [];
	const pendingFolderIds = rootFolders.map((folder) => folder.id);
	const visitedFolderIds = new Set<string>();

	while (pendingFolderIds.length > 0) {
		const folderIds: string[] = [];
		while (pendingFolderIds.length > 0 && folderIds.length < 8) {
			const folderId = pendingFolderIds.shift()!;
			if (visitedFolderIds.has(folderId)) continue;
			visitedFolderIds.add(folderId);
			folderIds.push(folderId);
		}

		const pages = await Promise.all(
			folderIds.map(async (folderId) => {
				const [childFolders, directFiles] = await Promise.all([
					listAll<FolderNode>((cursor) =>
						client.folders.list({ parent_id: folderId, cursor, limit: 100 }, undefined, options)
					),
					listAll<FileNode>((cursor) =>
						client.myFiles.list({ folder_id: folderId, cursor, limit: 100 }, undefined, options)
					)
				]);

				return { childFolders, directFiles };
			})
		);

		for (const { childFolders, directFiles } of pages) {
			folders.push(...childFolders);
			files.push(...directFiles);
			pendingFolderIds.push(...childFolders.map((folder) => folder.id));
		}
	}

	return calculateFolderSizes(folders, files);
}

/**
 * The trash endpoint returns a flat list of all trashed files, so one complete
 * listing is enough to calculate every trashed folder's recursive size.
 */
export async function getTrashedFolderSizes(
	client: FolderSizeClient
): Promise<Map<string, number>> {
	const [folders, files] = await Promise.all([
		listAll<FolderNode>((cursor) => client.folders.list({ trash: 'trashed', cursor, limit: 100 })),
		listAll<FileNode>((cursor) => client.myFiles.listTrash({ cursor, limit: 100 }))
	]);

	return calculateFolderSizes(folders, files);
}
