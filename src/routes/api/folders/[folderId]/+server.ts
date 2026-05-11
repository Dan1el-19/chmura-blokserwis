import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUserUnisourceClient } from '$lib/server/unisource';
import { mapFolderFromUnisource } from '$lib/server/unisource-mappers';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { updateFolderSchema } from '$lib/schemas';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const targetUserId = event.url.searchParams.get('targetUserId') || undefined;

	try {
		const client = await createUserUnisourceClient(event);
		const result = await client.folders.get(event.params.folderId, undefined, {
			asUser: targetUserId
		});
		return json(mapFolderFromUnisource(result.folder));
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to get folder');
	}
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const targetUserId = event.url.searchParams.get('targetUserId') || undefined;
	const permanent = event.url.searchParams.get('permanent') === 'true';

	try {
		const client = await createUserUnisourceClient(event);
		await client.folders.delete(event.params.folderId, { permanent }, undefined, {
			asUser: targetUserId
		});
		return json({ success: true });
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to delete folder');
	}
};

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await event.request.json();
	const targetUserId = event.url.searchParams.get('targetUserId') || undefined;

	const validated = updateFolderSchema.safeParse(body);
	if (!validated.success) {
		return json({ error: 'Validation error', details: validated.error.issues }, { status: 400 });
	}

	const { name, parentFolderId } = validated.data;

	try {
		const client = await createUserUnisourceClient(event);

		if (name !== undefined) {
			const result = await client.folders.update(event.params.folderId, { name }, undefined, {
				asUser: targetUserId
			});
			return json(mapFolderFromUnisource(result.folder));
		}

		if (parentFolderId !== undefined) {
			return json({ error: 'Folder move is postponed in UniSource migration' }, { status: 410 });
		}

		return json({ error: 'No valid operation specified' }, { status: 400 });
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to update folder');
	}
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const targetUserId = event.url.searchParams.get('targetUserId') || undefined;

	try {
		const body = await event.request.json().catch(() => ({}));
		if (body.action !== 'restore') {
			return json({ error: 'Unsupported action' }, { status: 400 });
		}

		const client = await createUserUnisourceClient(event);
		await client.folders.restore(event.params.folderId, undefined, { asUser: targetUserId });
		return json({ success: true });
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to restore folder');
	}
};
