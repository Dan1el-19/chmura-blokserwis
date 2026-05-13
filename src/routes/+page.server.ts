import { fail, redirect } from '@sveltejs/kit';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { mapFileFromUnisource, mapFolderFromUnisource } from '$lib/server/unisource-mappers';
import { getUserRole } from '$lib/server/roles';
import type { Actions, PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';

const PAGE_LIMIT = 50;

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const parentFolderId = url.searchParams.get('folder') || null;
	const fileCursor = url.searchParams.get('fileCursor') || undefined;
	const folderCursor = url.searchParams.get('folderCursor') || undefined;

	try {
		const client = await createUserUnisourceClient(event);
		const [files, folders] = await Promise.all([
			client.myFiles.list({
				folder_id: parentFolderId,
				cursor: fileCursor,
				limit: PAGE_LIMIT
			}),
			client.folders.list({
				parent_id: parentFolderId,
				cursor: folderCursor,
				limit: PAGE_LIMIT
			})
		]);

		// Build breadcrumb path by walking parent chain (max 20 levels)
		const folderPath: Array<{ id: string; name: string }> = [];
		if (parentFolderId) {
			let currentId: string | null = parentFolderId;
			let depth = 0;
			const visited = new Set<string>();
			while (currentId && depth++ < 20 && !visited.has(currentId)) {
				visited.add(currentId);
				const { folder } = await client.folders.get(currentId);
				folderPath.unshift({ id: folder.id, name: folder.name });
				currentId = folder.parent_id ?? null;
			}
		}

		return {
			files: files.items.map(mapFileFromUnisource),
			folders: folders.items.map(mapFolderFromUnisource),
			currentFolderId: parentFolderId,
			fileNextCursor: files.next_cursor,
			folderNextCursor: folders.next_cursor,
			role: getUserRole(locals.user),
			storageKind: 'user' as const,
			folderPath
		};
	} catch (error: unknown) {
		logger.error('Error fetching storage items:', error);
		return {
			files: [],
			folders: [],
			currentFolderId: parentFolderId,
			role: '',
			storageKind: 'user' as const,
			error: 'Failed to load storage items'
		};
	}
};

export const actions: Actions = {
	createFolder: async (event) => {
		const { request, locals } = event;
		if (!locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const data = await request.formData();
		const name = data.get('folderName') as string;
		const parentId = (data.get('parentFolderId') as string) || null;

		if (!name) {
			return fail(400, { error: 'Folder name is required' });
		}

		try {
			const client = await createUserUnisourceClient(event);
			await client.folders.create({
				name,
				...(parentId ? { parent_id: parentId } : {})
			});
			return { success: true };
		} catch (error: unknown) {
			logger.error('Error creating folder:', error);
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to create folder'
			});
		}
	}
};
