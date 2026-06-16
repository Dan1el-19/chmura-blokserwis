import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createRequestAdminUnisourceClient } from '$lib/server/unisource';
import { mapFileFromUnisource } from '$lib/server/unisource-mappers';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { getUserRole } from '$lib/server/roles';
import { unwrapList } from '$lib/server/unisource-v2-contract';

const DEFAULT_LIMIT = 50;

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (getUserRole(event.locals.user) === 'basic') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const client = await createRequestAdminUnisourceClient(event);
		const result = await client.mainStorage.list({
			cursor: event.url.searchParams.get('cursor') || undefined,
			limit: Number(event.url.searchParams.get('limit') || DEFAULT_LIMIT)
		});
		const list = unwrapList<Parameters<typeof mapFileFromUnisource>[0]>(result);

		return json({
			items: list.items.map(mapFileFromUnisource),
			next_cursor: list.nextCursor
		});
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to list main storage');
	}
};
