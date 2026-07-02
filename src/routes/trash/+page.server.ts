import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createUserUnisourceClient } from '$lib/server/unisource';
import { mapFileFromUnisource, mapFolderFromUnisource } from '$lib/server/unisource-mappers';
import { logger } from '$lib/server/logger';
import { unwrapList } from '$lib/server/unisource-v2-contract';

const PAGE_LIMIT = 50;

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		throw redirect(302, '/login');
	}

	const fileCursor = event.url.searchParams.get('fileCursor') || undefined;
	const folderCursor = event.url.searchParams.get('folderCursor') || undefined;

	try {
		const client = await createUserUnisourceClient(event);

		const [files, folders] = await Promise.all([
			client.myFiles.listTrash({ cursor: fileCursor, limit: PAGE_LIMIT }),
			client.folders.list(
				{ trash: 'trashed', cursor: folderCursor, limit: PAGE_LIMIT, parent_id: null },
				undefined
			)
		]);
		const fileList = unwrapList<Parameters<typeof mapFileFromUnisource>[0]>(files);
		const folderList = unwrapList<Parameters<typeof mapFolderFromUnisource>[0]>(folders);

		return {
			files: fileList.items.map(mapFileFromUnisource),
			folders: folderList.items.map(mapFolderFromUnisource),
			fileNextCursor: fileList.nextCursor,
			folderNextCursor: folderList.nextCursor
		};
	} catch (error) {
		logger.error('Error fetching trash items:', error);
		return {
			files: [],
			folders: [],
			fileNextCursor: null,
			folderNextCursor: null,
			error: 'Nie udało się załadować elementów kosza'
		};
	}
};
