import { fail, redirect } from '@sveltejs/kit';
import { listFiles, createFile } from '$lib/server/storage/files';
import { listFolders, createFolder } from '$lib/server/storage/folders';
import { getUserRole, MAIN_STORAGE_OWNER_ID } from '$lib/server/roles';
import type { Actions, PageServerLoad } from './$types';
import { logger } from '$lib/server/logger';

export const load: PageServerLoad = async ({ locals, url }) => {
	if (!locals.user) {
		throw redirect(302, '/login');
	}

	const role = getUserRole(locals.user);
	if (role === 'basic') {
		throw redirect(303, '/');
	}

	const parentFolderId = url.searchParams.get('folder') || null;

	try {
		const [files, folders] = await Promise.all([
			listFiles(MAIN_STORAGE_OWNER_ID, parentFolderId),
			listFolders(MAIN_STORAGE_OWNER_ID, parentFolderId)
		]);

		return {
			files: files.rows,
			folders: folders.rows,
			currentFolderId: parentFolderId,
			role
		};
	} catch (error: any) {
		logger.error('Error fetching main storage items:', error);
		return {
			files: [],
			folders: [],
			currentFolderId: parentFolderId,
			role,
			error: 'Failed to load storage items'
		};
	}
};

export const actions: Actions = {
	createFolder: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Unauthorized' });

		const role = getUserRole(locals.user);
		if (role === 'basic') return fail(403, { error: 'Forbidden' });

		const data = await request.formData();
		const name = data.get('folderName') as string;
		const parentId = (data.get('parentFolderId') as string) || null;

		if (!name) return fail(400, { error: 'Folder name is required' });

		try {
			await createFolder(MAIN_STORAGE_OWNER_ID, name, parentId);
			return { success: true };
		} catch (error: any) {
			logger.error('Error creating folder:', error);
			return fail(500, { error: error.message });
		}
	},

	createFile: async ({ request, locals }) => {
		if (!locals.user) return fail(401, { error: 'Unauthorized' });

		const role = getUserRole(locals.user);
		if (role === 'basic') return fail(403, { error: 'Forbidden' });

		const data = await request.formData();
		const name = data.get('name') as string;
		const size = parseInt(data.get('size') as string);
		const mimeType = data.get('mimeType') as string;
		const r2Key = data.get('r2Key') as string;
		const parentFolderId = (data.get('parentFolderId') as string) || null;

		if (!name || isNaN(size) || !mimeType || !r2Key) {
			return fail(400, { error: 'Missing file metadata' });
		}

		const bucketId = 'default';

		try {
			await createFile({
				name,
				size,
				mimeType,
				r2Key,
				bucketId,
				ownerId: MAIN_STORAGE_OWNER_ID,
				parentFolderId
			});
			return { success: true };
		} catch (error: any) {
			logger.error('Error creating file metadata:', error);
			return fail(500, { error: error.message });
		}
	}
};
