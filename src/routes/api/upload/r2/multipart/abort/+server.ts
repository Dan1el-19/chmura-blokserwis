import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';

/**
 * Proxy → UniSource `DELETE /upload/r2/multipart/abort`
 * Aborts an in-flight multipart upload and releases reserved quota.
 */
export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		if (!body.upload_id) {
			return json({ error: 'Missing upload_id' }, { status: 400 });
		}

		const client = await createUserUnisourceClient(event);
		const result = await client.upload.multipart.abort(body.upload_id);
		return json(result);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to abort multipart upload');
	}
};
