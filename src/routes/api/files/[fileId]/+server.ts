import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	deleteFile,
	renameFile,
	moveFile,
	getFileMetadata,
	getFileDownloadUrl
} from '$lib/server/storage/files';
import { getUserRole, MAIN_STORAGE_OWNER_ID } from '$lib/server/roles';
import { updateFileSchema } from '$lib/schemas';

async function checkAccess(
	fileId: string,
	user: any,
	mode: 'read' | 'write' = 'read',
	targetUserId?: string | null
) {
	const file = await getFileMetadata(fileId);
	const role = getUserRole(user);

	if (role === 'admin' && targetUserId) {
		if (file.ownerId === targetUserId) {
			return { file, effectiveUserId: targetUserId };
		}
	}

	if (file.ownerId === user.$id) return { file, effectiveUserId: user.$id };

	if (file.ownerId === MAIN_STORAGE_OWNER_ID && role !== 'basic') {
		return { file, effectiveUserId: MAIN_STORAGE_OWNER_ID };
	}

	throw new Error('Access denied');
}

export const GET: RequestHandler = async ({ params, locals, url }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { fileId } = params;
	const targetUserId = url.searchParams.get('targetUserId');

	try {
		const { file, effectiveUserId } = await checkAccess(fileId, user, 'read', targetUserId);
		const includeDownloadUrl = url.searchParams.get('download') === 'true';

		if (includeDownloadUrl) {
			const { file: fileObj, url: downloadUrl } = await getFileDownloadUrl(fileId, effectiveUserId);
			return json({ ...fileObj, downloadUrl });
		}

		return json(file);
	} catch (error: any) {
		if (error.message.includes('Access denied') || error.message.includes('Forbidden')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}
		return json({ error: error.message }, { status: 404 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals, url }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { fileId } = params;
	const targetUserId = url.searchParams.get('targetUserId');

	try {
		const { effectiveUserId } = await checkAccess(fileId, user, 'write', targetUserId);
		await deleteFile(fileId, effectiveUserId);
		return json({ success: true });
	} catch (error: any) {
		if (error.message.includes('Access denied') || error.message.includes('Forbidden')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}
		return json({ error: error.message }, { status: 500 });
	}
};

export const PATCH: RequestHandler = async ({ params, locals, request, url }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { fileId } = params;
	const body = await request.json();
	const targetUserId = url.searchParams.get('targetUserId');

	const validated = updateFileSchema.safeParse(body);
	if (!validated.success) {
		return json({ error: 'Validation error', details: validated.error.issues }, { status: 400 });
	}

	const { name, parentFolderId } = validated.data;

	try {
		const { effectiveUserId } = await checkAccess(fileId, user, 'write', targetUserId);

		if (name !== undefined) {
			const autoRename = body.autoRename === true;
			const file = await renameFile(fileId, name, effectiveUserId, autoRename);
			return json(file);
		}

		if (parentFolderId !== undefined) {
			const file = await moveFile(fileId, parentFolderId, effectiveUserId);
			return json(file);
		}

		return json({ error: 'No valid operation specified' }, { status: 400 });
	} catch (error: any) {
		if (error.message.startsWith('Conflict:')) {
			const suggestion = error.message.replace('Conflict: ', '');
			return json({ error: 'Conflict', suggestion }, { status: 409 });
		}
		if (error.message.includes('Access denied') || error.message.includes('Forbidden')) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}
		return json({ error: error.message }, { status: 500 });
	}
};
