import { redirect, error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getUserRole } from '$lib/server/roles';
import { createUserUnisourceClient } from '$lib/server/unisource';
import { createAdminClient } from '$lib/server/appwrite';
import { mapFileFromUnisource, mapFolderFromUnisource } from '$lib/server/unisource-mappers';
import { logger } from '$lib/server/logger';
import { getActiveFolderSizes } from '$lib/server/folder-sizes';
import { unwrapList } from '$lib/server/unisource-v2-contract';

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

	const { users } = createAdminClient(event);
	let targetUser: { $id: string; name: string; email: string };
	try {
		const u = await users.get(userId);
		targetUser = { $id: u.$id, name: u.name, email: u.email };
	} catch {
		throw error(404, 'Użytkownik nie został znaleziony');
	}

	const admin = await createUserUnisourceClient(event);

	let files: ReturnType<typeof mapFileFromUnisource>[] = [];
	let folders: Array<ReturnType<typeof mapFolderFromUnisource> & { size: number }> = [];
	let breadcrumbs: { id: string | null; name: string }[] = [{ id: null, name: 'Root' }];
	let errorMsg: string | undefined;

	try {
		const [filesResult, foldersResult] = await Promise.all([
			admin.myFiles.list(
				{ ...(folderId ? { folder_id: folderId } : {}), limit: PAGE_LIMIT },
				undefined,
				{ asUser: userId }
			),
			admin.folders.list({ parent_id: folderId, limit: PAGE_LIMIT }, undefined, { asUser: userId })
		]);

		files =
			unwrapList<Parameters<typeof mapFileFromUnisource>[0]>(filesResult).items.map(
				mapFileFromUnisource
			);
		const rawFolders = unwrapList<Parameters<typeof mapFolderFromUnisource>[0]>(foldersResult).items;
		const folderSizes = await getActiveFolderSizes(admin, rawFolders, { asUser: userId }).catch(
			(sizeError) => {
				logger.warn('Error calculating preview folder sizes:', sizeError);
				return new Map<string, number>();
			}
		);
		folders = rawFolders.map((folder) => ({
			...mapFolderFromUnisource(folder),
			size: folderSizes.get(folder.id) ?? 0
		}));

		if (folderId) {
			const trail = (
				await admin.folders.breadcrumbs(folderId, undefined, { asUser: userId })
			).breadcrumbs.map(({ id, name }) => ({ id, name }));
			breadcrumbs = [{ id: null, name: 'Root' }, ...trail];
		}
	} catch (e) {
		logger.error('Preview UniSource error:', e);
		errorMsg = 'Nie udało się załadować plików użytkownika';
	}

	return {
		targetUser,
		files,
		folders,
		currentFolder: folderId,
		breadcrumbs,
		...(errorMsg ? { error: errorMsg } : {})
	};
};
