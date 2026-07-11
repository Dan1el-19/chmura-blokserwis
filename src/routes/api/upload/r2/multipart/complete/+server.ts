import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient, requestUserUnisourceV2 } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { unwrapItem } from '$lib/server/unisource-v2-contract';
import { multipartCompleteSchema } from '$lib/schemas';

/**
 * Proxy → UniSource `POST /upload/r2/multipart/complete`
 * Finalises the multipart upload and promotes it to a file record.
 */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const validated = multipartCompleteSchema.safeParse(body);
		if (!validated.success) {
			return json({ error: 'Validation failed', details: validated.error.issues }, { status: 400 });
		}
		const { upload_id, parts, migrate_to_appwrite } = validated.data;

		if (migrate_to_appwrite) {
			return json(
				unwrapItem(
					await requestUserUnisourceV2(event, 'POST', '/v2/upload/r2/multipart/complete', {
						body: { upload_id, parts, migrate_to_appwrite: true }
					})
				)
			);
		}
		const client = await createUserUnisourceClient(event);
		const result = unwrapItem(await client.upload.multipartComplete(upload_id, parts));

		return json(result);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to complete multipart upload');
	}
};
