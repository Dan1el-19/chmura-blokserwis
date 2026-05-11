import { fail, redirect } from '@sveltejs/kit';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { mapFileFromUnisource } from '$lib/server/unisource-mappers';
import { getUserRole } from '$lib/server/roles';
import type { Actions, PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';

const PAGE_LIMIT = 50;

export const load: PageServerLoad = async (event) => {
	const { locals, url } = event;
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const role = getUserRole(locals.user);
	if (role === 'basic') {
		throw redirect(303, '/');
	}

	const fileCursor = url.searchParams.get('fileCursor') || undefined;

	try {
		const client = createAdminUnisourceClient(event);
		const files = await client.mainStorage.list({ cursor: fileCursor, limit: PAGE_LIMIT });

		return {
			files: files.items.map(mapFileFromUnisource),
			folders: [],
			currentFolderId: null,
			fileNextCursor: files.next_cursor,
			role,
			storageKind: 'main' as const
		};
	} catch (error: any) {
		logger.error('Error fetching main storage items:', error);
		return {
			files: [],
			folders: [],
			currentFolderId: null,
			role,
			storageKind: 'main' as const,
			error: 'Failed to load storage items'
		};
	}
};

export const actions: Actions = {
	createFolder: async () => {
		return fail(410, { error: 'Main storage folders are postponed in UniSource migration' });
	},

	createFile: async () => {
		return fail(410, { error: 'Upload metadata is handled by UniSource upload.complete()' });
	}
};
