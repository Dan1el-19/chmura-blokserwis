import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createRequestAdminUnisourceClient } from '$lib/server/unisource';
import { promoteLatest } from '$lib/server/storage/releases';
import { getUserRole } from '$lib/server/roles';
import { logger } from '$lib/server/logger';
import { unwrapItem } from '$lib/server/unisource-v2-contract';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || getUserRole(event.locals.user) !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body = await event.request.json();
	const { release_id, size, channel } = body;

	if (!release_id || typeof size !== 'number') {
		return json({ error: 'release_id and size are required' }, { status: 400 });
	}

	try {
		const client = await createRequestAdminUnisourceClient(event);
		const result = unwrapItem(await client.releases.uploadComplete(release_id, size));

		// Promote this release to `latest` within its channel, stripping `latest` from previous
		const ch = typeof channel === 'string' ? channel : 'stable';
		await promoteLatest(ch, release_id, event);

		return json(result);
	} catch (error: any) {
		logger.error('Failed to complete release upload:', error);
		return json({ error: 'Failed to complete release upload' }, { status: 500 });
	}
};
