import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { getUserRole } from '$lib/server/roles';
import { unwrapItem } from '$lib/server/unisource-v2-contract';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const client = await createUserUnisourceClient(event);

		if (body.is_main_storage) {
			if (getUserRole(event.locals.user) === 'basic') {
				return json({ error: 'Forbidden' }, { status: 403 });
			}
			return json(unwrapItem(await client.upload.uploadFail(body.upload_id)));
		}

		return json(unwrapItem(await client.upload.uploadFail(body.upload_id)));
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to fail upload');
	}
};
