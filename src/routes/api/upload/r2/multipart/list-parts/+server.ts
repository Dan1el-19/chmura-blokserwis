import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { multipartListPartsSchema } from '$lib/schemas';

/**
 * Proxy → UniSource `GET /upload/r2/multipart/list-parts`
 * Returns parts already uploaded for resume via Golden Retriever.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const validated = multipartListPartsSchema.safeParse({
		upload_id: event.url.searchParams.get('upload_id')
	});
	if (!validated.success) {
		return json({ error: 'Validation failed', details: validated.error.issues }, { status: 400 });
	}
	const { upload_id: uploadId } = validated.data;

	try {
		const client = await createUserUnisourceClient(event);
		const result = await client.upload.multipartListParts(uploadId);
		return json({ parts: result.items });
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to list uploaded parts');
	}
};
