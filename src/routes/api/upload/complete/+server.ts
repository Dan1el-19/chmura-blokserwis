import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient, requestUserUnisourceV2 } from '$lib/server/unisource';
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
		const { upload_id, is_main_storage, migrate_to_appwrite } = validated.data;
		if (is_main_storage && getUserRole(event.locals.user) === 'basic') {
			return json({ error: 'Forbidden' }, { status: 403 });
		}
		if (migrate_to_appwrite) {
			return json(
				unwrapItem(
					await requestUserUnisourceV2(event, 'POST', '/v2/upload/complete', {
						body: {
							upload_id,
							is_main_storage: Boolean(is_main_storage),
							migrate_to_appwrite: true
						}
					})
				)
			);
		}
		const client = await createUserUnisourceClient(event);

		if (is_main_storage) {
			return json(
				unwrapItem(await client.upload.complete(upload_id, undefined, { isMainStorage: true }))
			);
		}

		return json(unwrapItem(await client.upload.complete(upload_id)));
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to complete upload');
	}
};
