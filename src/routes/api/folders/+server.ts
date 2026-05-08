import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { mapFolderFromUnisource } from '$lib/server/unisource-mappers';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';

const DEFAULT_LIMIT = 50;

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const parentId = event.url.searchParams.get('parentId') || null;
	const cursor = event.url.searchParams.get('cursor') || undefined;
	const targetUserId = event.url.searchParams.get('targetUserId') || undefined;
	const isTrashed = event.url.searchParams.get('trash') === 'true';
	const limit = Number(event.url.searchParams.get('limit') || DEFAULT_LIMIT);

	try {
		const client = await createUserUnisourceClient(event);
		const result = await client.folders.list(
			{ parent_id: parentId, is_trashed: isTrashed, cursor, limit },
			undefined,
			{ asUser: targetUserId }
		);

		return json({
			items: result.items.map(mapFolderFromUnisource),
			next_cursor: result.next_cursor,
			limit: result.limit
		});
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to list folders');
	}
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const client = await createUserUnisourceClient(event);
		const result = await client.folders.create({
			name: body.name,
			...(body.parentFolderId ? { parent_id: body.parentFolderId } : {})
		});

		return json(mapFolderFromUnisource(result.folder));
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to create folder');
	}
};
