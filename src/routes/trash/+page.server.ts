import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { createUserUnisourceClient } from '$lib/server/unisource';
import { mapFileFromUnisource, mapFolderFromUnisource } from '$lib/server/unisource-mappers';
import { logger } from '$lib/server/logger';

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
			client.myFiles.trash({ cursor: fileCursor, limit: PAGE_LIMIT }),
			client.folders.list(
				{ is_trashed: true, cursor: folderCursor, limit: PAGE_LIMIT, parent_id: null },
				undefined
			)
		]);

		return {
			files: files.items.map(mapFileFromUnisource),
			folders: folders.items.map(mapFolderFromUnisource),
			fileNextCursor: files.next_cursor,
			folderNextCursor: folders.next_cursor
		};
	} catch (error) {
		logger.error('Error fetching trash items:', error);
		return {
			files: [],
			folders: [],
			fileNextCursor: null,
			folderNextCursor: null,
			error: 'Failed to load trash items'
		};
	}
};
