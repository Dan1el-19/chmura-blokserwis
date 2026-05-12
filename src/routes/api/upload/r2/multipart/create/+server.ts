import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { getUserRole } from '$lib/server/roles';

/**
 * Proxy → UniSource `POST /upload/r2/multipart/create`
 * Reserves quota, creates an R2 multipart upload, stores the upload record in D1.
 */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const client = await createUserUnisourceClient(event);

		const isMainStorage = body.is_main_storage === true;
		if (isMainStorage && getUserRole(event.locals.user) === 'basic') {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		const init = await client.upload.multipart.create({
			filename: body.filename,
			size: body.size,
			mime_type: body.mime_type,
			is_main_storage: isMainStorage,
			...(body.folder_id ? { folder_id: body.folder_id } : {})
		});

		return json(init);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to create multipart upload');
	}
};
