import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUserUnisourceClient } from '$lib/server/unisource';
import { mapFileFromUnisource } from '$lib/server/unisource-mappers';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { updateFileSchema } from '$lib/schemas';
import { unwrapItem } from '$lib/server/unisource-v2-contract';

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
			const download = unwrapItem<{ download_url: string; expires_at: number }>(
				await client.userFiles.downloadUrl(fileId, undefined, {
					asUser: targetUserId
				})
			);
			return json({ downloadUrl: download.download_url, expiresAt: download.expires_at });
		}

		const file = unwrapItem<Parameters<typeof mapFileFromUnisource>[0]>(
			await client.userFiles.get(fileId, undefined, {
				asUser: targetUserId
			})
		);
		return json(mapFileFromUnisource(file));
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
		await client.userFiles.delete(fileId, undefined, { permanent, asUser: targetUserId });
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
			const file = unwrapItem<Parameters<typeof mapFileFromUnisource>[0]>(
				await client.userFiles.update(fileId, { filename: name }, undefined, {
					asUser: targetUserId
				})
			);
			return json(mapFileFromUnisource(file));
		}

		if (parentFolderId !== undefined) {
			await client.myFiles.move(fileId, { folder_id: parentFolderId }, undefined, {
				asUser: targetUserId
			});
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
		await client.userFiles.restore(event.params.fileId, undefined, { asUser: targetUserId });
		return json({ success: true });
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to restore file');
	}
};
