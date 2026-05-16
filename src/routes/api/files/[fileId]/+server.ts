import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUserUnisourceClient } from '$lib/server/unisource';
import { mapFileFromUnisource } from '$lib/server/unisource-mappers';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { updateFileSchema } from '$lib/schemas';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { fileId } = event.params;
	const targetUserId = event.url.searchParams.get('targetUserId') || undefined;

	try {
		const client = await createUserUnisourceClient(event);
		const includeDownloadUrl = event.url.searchParams.get('download') === 'true';

		if (includeDownloadUrl) {
			const download = await client.myFiles.downloadUrl(fileId, undefined, {
				asUser: targetUserId
			});
			return json({ downloadUrl: download.download_url, expiresAt: download.expires_at });
		}

		const result = await client.myFiles.get(fileId, undefined, { asUser: targetUserId });
		if (!result?.file) {
			return json({ error: 'Get failed: no file returned' }, { status: 500 });
		}
		return json(mapFileFromUnisource(result.file));
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to get file');
	}
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { fileId } = event.params;
	const targetUserId = event.url.searchParams.get('targetUserId') || undefined;
	const permanent = event.url.searchParams.get('permanent') === 'true';

	try {
		const client = await createUserUnisourceClient(event);
		await client.myFiles.delete(fileId, { permanent }, undefined, { asUser: targetUserId });
		return json({ success: true });
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to delete file');
	}
};

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { fileId } = event.params;
	const body = await event.request.json();
	const targetUserId = event.url.searchParams.get('targetUserId') || undefined;

	const validated = updateFileSchema.safeParse(body);
	if (!validated.success) {
		return json({ error: 'Validation error', details: validated.error.issues }, { status: 400 });
	}

	const { name, parentFolderId } = validated.data;

	try {
		const client = await createUserUnisourceClient(event);

		if (name !== undefined) {
			const result = await client.myFiles.update(fileId, { filename: name }, undefined, {
				asUser: targetUserId
			});
			if (!result?.file) {
				return json({ error: 'Update failed: no file returned' }, { status: 500 });
			}
			return json(mapFileFromUnisource(result.file));
		}

		if (parentFolderId !== undefined) {
			const result = await client.myFiles.move(fileId, { folder_id: parentFolderId }, undefined, {
				asUser: targetUserId
			});
			if (result?.file) {
				return json(mapFileFromUnisource(result.file));
			}
			return json({ success: true });
		}

		return json({ error: 'No valid operation specified' }, { status: 400 });
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to update file');
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
		await client.myFiles.restore(event.params.fileId, undefined, { asUser: targetUserId });
		return json({ success: true });
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to restore file');
	}
};
