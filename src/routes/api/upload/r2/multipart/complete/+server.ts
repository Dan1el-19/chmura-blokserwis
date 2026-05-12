import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';

/**
 * Proxy → UniSource `POST /upload/r2/multipart/complete`
 * Finalises the multipart upload and promotes it to a file record.
 */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();

		if (!body.upload_id || !Array.isArray(body.parts) || body.parts.length === 0) {
			return json({ error: 'Missing upload_id or parts' }, { status: 400 });
		}

		const client = await createUserUnisourceClient(event);
		const result = await client.upload.multipart.complete({
			upload_id: body.upload_id,
			parts: body.parts
		});

		return json(result);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to complete multipart upload');
	}
};
