import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listReleases } from '$lib/server/storage/releases';
import { createRequestAdminUnisourceClient } from '$lib/server/unisource';
import { getUserRole } from '$lib/server/roles';
import { logger } from '$lib/server/logger';
import { unwrapItem } from '$lib/server/unisource-v2-contract';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || getUserRole(event.locals.user) !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const releases = await listReleases(event);
	return json({ releases });
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || getUserRole(event.locals.user) !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body = await event.request.json();
	const { name, filename, tags, notes, force_update } = body;

	if (!name || !filename) {
		return json({ error: 'name and filename are required' }, { status: 400 });
	}

	const client = await createRequestAdminUnisourceClient(event);

	try {
		const init = unwrapItem(
			await client.releases.uploadInit({
				name,
				filename,
				tags: tags ?? [],
				notes: notes ?? null,
				force_update: force_update ?? false
			})
		);
		return json(init, { status: 201 });
	} catch (error: any) {
		logger.error('Failed to init release upload:', error);
		return json({ error: 'Failed to init release upload' }, { status: 500 });
	}
};
