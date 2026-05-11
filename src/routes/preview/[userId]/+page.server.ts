import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserRole } from '$lib/server/roles';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { mapFileFromUnisource, mapFolderFromUnisource } from '$lib/server/unisource-mappers';

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

	const admin = createAdminUnisourceClient(event);

	try {
		const [filesResult, foldersResult, userInfo] = await Promise.all([
			admin.myFiles.list({ folder_id: folderId, limit: PAGE_LIMIT }, undefined, { asUser: userId }),
			admin.folders.list({ parent_id: folderId, limit: PAGE_LIMIT }, undefined, { asUser: userId }),
			admin.admin.listUsers({ limit: 1, offset: 0 }).catch(() => null)
		]);

		let breadcrumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Root' }];

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

		return {
			targetUser: {
				$id: userId,
				name: userId,
				email: ''
			},
			files: filesResult.items.map(mapFileFromUnisource),
			folders: foldersResult.items.map(mapFolderFromUnisource),
			currentFolder: folderId,
			breadcrumbs
		};
	} catch (e) {
		throw error(404, 'Użytkownik nie został znaleziony');
	}
};
