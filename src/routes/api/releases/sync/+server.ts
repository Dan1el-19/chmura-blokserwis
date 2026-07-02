import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createRequestAdminUnisourceClient } from '$lib/server/unisource';
import { unwrapItem } from '$lib/server/unisource-v2-contract';
import { getUserRole } from '$lib/server/roles';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user || getUserRole(event.locals.user) !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const client = await createRequestAdminUnisourceClient(event);
		const latest = await client.releases.latest();
		return json({ config: unwrapItem(latest) });
	} catch {
		return json({ config: null });
	}
};

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user || getUserRole(event.locals.user) !== 'admin') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	const body = await event.request.json();
	const { releases } = body;

	if (!Array.isArray(releases)) {
		return json({ error: 'releases array is required' }, { status: 400 });
	}

	try {
		const client = await createRequestAdminUnisourceClient(event);
		const result = await client.releases.sync({ releases });
		logger.info(`Synced ${result.processed.length} releases`);
		return json(result);
	} catch (error: any) {
		logger.error('Failed to sync releases:', error);
		return json({ error: 'Failed to sync releases' }, { status: 500 });
	}
};
