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
			return json(await client.mainStorage.upload.complete(body.upload_id));
		}

		return json(
			await client.upload.complete({ upload_id: body.upload_id, is_main_storage: false })
		);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to complete upload');
	}
};
