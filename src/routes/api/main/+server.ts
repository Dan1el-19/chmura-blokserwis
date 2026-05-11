import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createAdminUnisourceClient } from '$lib/server/unisource';
import { mapFileFromUnisource } from '$lib/server/unisource-mappers';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { getUserRole } from '$lib/server/roles';

const DEFAULT_LIMIT = 50;

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	if (getUserRole(event.locals.user) === 'basic') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const client = createAdminUnisourceClient(event);
		const result = await client.mainStorage.list({
			cursor: event.url.searchParams.get('cursor') || undefined,
			limit: Number(event.url.searchParams.get('limit') || DEFAULT_LIMIT)
		});

		return json({
			items: result.items.map(mapFileFromUnisource),
			next_cursor: result.next_cursor
		});
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to list main storage');
	}
};
