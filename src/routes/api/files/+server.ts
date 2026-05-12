import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { mapFileFromUnisource } from '$lib/server/unisource-mappers';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { getUserRole } from '$lib/server/roles';

const DEFAULT_LIMIT = 50;

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const folderId = event.url.searchParams.get('folderId') || null;
	const cursor = event.url.searchParams.get('cursor') || undefined;
	const rawTargetUserId = event.url.searchParams.get('targetUserId') || undefined;
	if (rawTargetUserId && getUserRole(event.locals.user) !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}
	const targetUserId = rawTargetUserId;
	const trash = event.url.searchParams.get('trash') === 'true';
	const limit = Number(event.url.searchParams.get('limit') || DEFAULT_LIMIT);

	try {
		const client = await createUserUnisourceClient(event);
		const result = trash
			? await client.myFiles.trash({ cursor, limit }, undefined, { asUser: targetUserId })
			: await client.myFiles.list({ folder_id: folderId, cursor, limit }, undefined, {
					asUser: targetUserId
				});

		return json({
			items: result.items.map(mapFileFromUnisource),
			next_cursor: result.next_cursor,
			limit: result.limit
		});
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to list files');
	}
};
