import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { promoteLatest } from '$lib/server/storage/releases';
import { logger } from '$lib/server/logger';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await event.request.json();
	const { release_id, size, channel } = body;

	if (!release_id || typeof size !== 'number') {
		return json({ error: 'release_id and size are required' }, { status: 400 });
	}

	try {
		const client = createAdminUnisourceClient(event);
		const result = await client.releases.upload.complete({ release_id, size });

		// Promote this release to `latest` within its channel, stripping `latest` from previous
		const ch = typeof channel === 'string' ? channel : 'stable';
		await promoteLatest(ch, release_id, event);

		return json(result);
	} catch (error: any) {
		logger.error('Failed to complete release upload:', error);
		return json({ error: error?.message || 'Failed to complete release upload' }, { status: 500 });
	}
};
