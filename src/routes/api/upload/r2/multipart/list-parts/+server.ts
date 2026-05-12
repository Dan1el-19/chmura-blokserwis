import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';

/**
 * Proxy → UniSource `GET /upload/r2/multipart/list-parts`
 * Returns parts already uploaded for resume via Golden Retriever.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const uploadId = event.url.searchParams.get('upload_id');
	if (!uploadId) {
		return json({ error: 'Missing upload_id' }, { status: 400 });
	}

	try {
		const client = await createUserUnisourceClient(event);
		const result = await client.upload.multipart.listParts(uploadId);
		return json(result);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to list uploaded parts');
	}
};
