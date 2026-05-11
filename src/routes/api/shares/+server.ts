import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { mapShareLinkFromUnisource } from '$lib/server/unisource-mappers';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';

function toUnixTimestamp(value: unknown): number | undefined {
	if (typeof value !== 'string' || value.length === 0) return undefined;
	const timestamp = Math.floor(new Date(value).getTime() / 1000);
	return Number.isFinite(timestamp) ? timestamp : undefined;
}

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const fileId = event.url.searchParams.get('fileId');
	const folderId = event.url.searchParams.get('folderId');

	if (folderId) {
		return json({ error: 'Folder shares are postponed in UniSource migration' }, { status: 410 });
	}

	if (!fileId) {
		return json({ error: 'Missing fileId' }, { status: 400 });
	}

	try {
		const client = await createUserUnisourceClient(event);
		const result = await client.shareLinks.list(fileId);
		return json(result.items.map(mapShareLinkFromUnisource));
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to list shares');
	}
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		if (body.folderId) {
			return json({ error: 'Folder shares are postponed in UniSource migration' }, { status: 410 });
		}
		if (!body.fileId) {
			return json({ error: 'Missing fileId' }, { status: 400 });
		}

		const client = await createUserUnisourceClient(event);
		const result = await client.shareLinks.create(body.fileId, {
			...(body.customSlug ? { slug: body.customSlug } : {}),
			...(body.label ? { name: body.label } : {}),
			...(body.password ? { password: body.password } : {}),
			...(toUnixTimestamp(body.expiresAt) ? { expires_at: toUnixTimestamp(body.expiresAt) } : {}),
			...(body.maxDownloads ? { max_downloads: Number(body.maxDownloads) } : {})
		});

		return json(mapShareLinkFromUnisource(result.link));
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to create share');
	}
};
