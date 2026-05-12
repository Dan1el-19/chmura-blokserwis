import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listReleases } from '$lib/server/storage/releases';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async (event) => {
	const releases = await listReleases(event);
	return json({ releases });
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await event.request.json();
	const { name, filename, tags, notes, force_update } = body;

	if (!name || !filename) {
		return json({ error: 'name and filename are required' }, { status: 400 });
	}

	const client = createAdminUnisourceClient(event);

	try {
		const init = await client.releases.upload.init({
			name,
			filename,
			tags: tags ?? [],
			notes: notes ?? null,
			force_update: force_update ?? false
		});
		return json(init, { status: 201 });
	} catch (error: any) {
		logger.error('Failed to init release upload:', error);
		return json({ error: error?.message || 'Failed to init release upload' }, { status: 500 });
	}
};
