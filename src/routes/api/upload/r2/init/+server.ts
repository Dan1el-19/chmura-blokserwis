import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { getUserRole } from '$lib/server/roles';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const client = await createUserUnisourceClient(event);
		if (body.is_main_storage) {
			if (getUserRole(event.locals.user) === 'basic') {
				return json({ error: 'Forbidden' }, { status: 403 });
			}
			return json(
				await client.mainStorage.upload.r2Init({
					filename: body.filename,
					size: body.size,
					mime_type: body.mime_type,
					...(body.folder_id ? { folder_id: body.folder_id } : {})
				})
			);
		}

		return json(
			await client.upload.r2Init({
				filename: body.filename,
				size: body.size,
				mime_type: body.mime_type,
				is_main_storage: false,
				...(body.folder_id ? { folder_id: body.folder_id } : {})
			})
		);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to initialize upload');
	}
};
