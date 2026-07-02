import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { getUserRole } from '$lib/server/roles';
import { unwrapItem } from '$lib/server/unisource-v2-contract';
import { uploadActionSchema } from '$lib/schemas';

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const validated = uploadActionSchema.safeParse(body);
		if (!validated.success) {
			return json({ error: 'Validation failed', details: validated.error.issues }, { status: 400 });
		}
		const { upload_id, is_main_storage } = validated.data;
		const client = await createUserUnisourceClient(event);

		if (is_main_storage) {
			if (getUserRole(event.locals.user) === 'basic') {
				return json({ error: 'Forbidden' }, { status: 403 });
			}
			return json(unwrapItem(await client.upload.uploadFail(upload_id)));
		}

		return json(unwrapItem(await client.upload.uploadFail(upload_id)));
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to fail upload');
	}
};
