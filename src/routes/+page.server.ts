import { fail, redirect } from '@sveltejs/kit';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { mapFileFromUnisource, mapFolderFromUnisource } from '$lib/server/unisource-mappers';
import { getUserRole } from '$lib/server/roles';
import type { Actions, PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';
import { unwrapList } from '$lib/server/unisource-v2-contract';

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
				...(parentFolderId ? { folder_id: parentFolderId } : {}),
				cursor: fileCursor,
				limit: PAGE_LIMIT
			}),
			client.folders.list({
				parent_id: parentFolderId,
				cursor: folderCursor,
				limit: PAGE_LIMIT
			})
		]);

		const fileList = unwrapList<Parameters<typeof mapFileFromUnisource>[0]>(files);
		const folderList = unwrapList<Parameters<typeof mapFolderFromUnisource>[0]>(folders);
		const folderPath = parentFolderId
			? (await client.folders.breadcrumbs(parentFolderId)).breadcrumbs.map(({ id, name }) => ({
					id,
					name
				}))
			: [];

		return {
			files: fileList.items.map(mapFileFromUnisource),
			folders: folderList.items.map(mapFolderFromUnisource),
			currentFolderId: parentFolderId,
			fileNextCursor: fileList.nextCursor,
			folderNextCursor: folderList.nextCursor,
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
			error: 'Nie udało się załadować elementów magazynu'
		};
	}
};

export const actions: Actions = {
	createFolder: async (event) => {
		const { request, locals } = event;
		if (!locals.user) {
			return fail(401, { error: 'Brak autoryzacji' });
		}

		const data = await request.formData();
		const name = data.get('folderName') as string;
		const parentId = (data.get('parentFolderId') as string) || null;

		if (!name) {
			return fail(400, { error: 'Nazwa folderu jest wymagana' });
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
				error: error instanceof Error ? error.message : 'Nie udało się utworzyć folderu'
			});
		}
	}
};
