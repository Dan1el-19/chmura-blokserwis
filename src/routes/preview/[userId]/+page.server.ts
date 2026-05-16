import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserRole } from '$lib/server/roles';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { createAdminClient } from '$lib/server/appwrite';
import { mapFileFromUnisource, mapFolderFromUnisource } from '$lib/server/unisource-mappers';
import type { FileDocument, FolderDocument } from '$lib/types/storage';

const PAGE_LIMIT = 50;

export const load: PageServerLoad = async (event) => {
	const { locals, params, url } = event;

	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const role = getUserRole(locals.user);
	if (role !== 'admin') {
		throw redirect(303, '/');
	}

	const { userId } = params;
	const folderId = url.searchParams.get('folder') || null;

	// Fetch user from Appwrite
	const { users } = createAdminClient(event);
	let targetUser;
	try {
		targetUser = await users.get(userId);
	} catch {
		throw error(404, 'Użytkownik nie został znaleziony');
	}

	const admin = createAdminUnisourceClient(event);

	let files: (FileDocument & { isTrashed: boolean })[] = [];
	let folders: (FolderDocument & { isTrashed: boolean })[] = [];
	let breadcrumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Root' }];
	let errorMsg: string | undefined;

	try {
		const [filesResult, foldersResult] = await Promise.all([
			admin.myFiles.list({ folder_id: folderId, limit: PAGE_LIMIT }, undefined, { asUser: userId }),
			admin.folders.list({ parent_id: folderId, limit: PAGE_LIMIT }, undefined, { asUser: userId })
		]);

		files = filesResult.items.map(mapFileFromUnisource);
		folders = foldersResult.items.map(mapFolderFromUnisource);

		if (folderId) {
			const trail: { id: string; name: string }[] = [];
			let currentId: string | null = folderId;

			while (currentId) {
				const folderDetail = await admin.folders.get(currentId, undefined, { asUser: userId });
				trail.unshift({ id: folderDetail.folder.id, name: folderDetail.folder.name });
				currentId = folderDetail.folder.parent_id;
			}

			breadcrumbs = [{ id: null, name: 'Root' }, ...trail];
		}
	} catch (e) {
		errorMsg = 'Nie udało się załadować plików użytkownika';
	}

	return {
		targetUser: {
			$id: userId,
			name: targetUser.name || userId,
			email: targetUser.email
		},
		files,
		folders,
		currentFolder: folderId,
		breadcrumbs,
		error: errorMsg
	};
};
