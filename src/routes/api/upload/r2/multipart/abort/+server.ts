import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { unwrapItem } from '$lib/server/unisource-v2-contract';
import { multipartAbortSchema } from '$lib/schemas';

/**
 * Proxy → UniSource `DELETE /upload/r2/multipart/abort`
 * Aborts an in-flight multipart upload and releases reserved quota.
 */
export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const validated = multipartAbortSchema.safeParse(body);
		if (!validated.success) {
			return json({ error: 'Validation failed', details: validated.error.issues }, { status: 400 });
		}
		const { upload_id } = validated.data;

		const client = await createUserUnisourceClient(event);
		const result = unwrapItem(await client.upload.multipartAbort(upload_id));
		return json(result);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to abort multipart upload');
	}
};
