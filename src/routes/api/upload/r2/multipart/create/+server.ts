import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { getUserRole } from '$lib/server/roles';
import { unwrapItem } from '$lib/server/unisource-v2-contract';
import { uploadInitSchema } from '$lib/schemas';

/**
 * Proxy → UniSource `POST /upload/r2/multipart/create`
 * Reserves quota, creates an R2 multipart upload, stores the upload record in D1.
 */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const validated = uploadInitSchema.safeParse(body);
		if (!validated.success) {
			return json({ error: 'Validation failed', details: validated.error.issues }, { status: 400 });
		}
		const { filename, size, mime_type, is_main_storage, folder_id } = validated.data;
		const client = await createUserUnisourceClient(event);

		const isMainStorage = is_main_storage === true;
		if (isMainStorage && getUserRole(event.locals.user) === 'basic') {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const init = unwrapItem(
			await client.upload.multipartCreate({
				filename,
				size,
				mime_type,
				is_main_storage: isMainStorage,
				...(folder_id ? { folder_id } : {})
			})
		);

		return json(init);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to create multipart upload');
	}
};
