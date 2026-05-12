import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { getUserRole } from '$lib/server/roles';
import { requireRuntimeEnv } from '$lib/server/runtime-env';
import { assertPresignedUrlMatchesR2Config } from '$lib/server/storage/r2-url';

function assertUploadUsesConfiguredR2(
	presignedUrl: string,
	event: Pick<RequestEvent, 'platform'>
): void {
	assertPresignedUrlMatchesR2Config(
		presignedUrl,
		requireRuntimeEnv(event, 'R2_ENDPOINT'),
		requireRuntimeEnv(event, 'R2_BUCKET_NAME')
	);
}

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const client = await createUserUnisourceClient(event);
		if (body.is_main_storage) {
			if (getUserRole(event.locals.user) === 'basic') {
				return json({ error: 'Forbidden' }, { status: 403 });
			}
			const init = await client.mainStorage.upload.r2Init({
				filename: body.filename,
				size: body.size,
				mime_type: body.mime_type,
				...(body.folder_id ? { folder_id: body.folder_id } : {})
			});
			assertUploadUsesConfiguredR2(init.presigned_url, event);
			return json(init);
		}

		const init = await client.upload.r2Init({
			filename: body.filename,
			size: body.size,
			mime_type: body.mime_type,
			is_main_storage: false,
			...(body.folder_id ? { folder_id: body.folder_id } : {})
		});
		assertUploadUsesConfiguredR2(init.presigned_url, event);
		return json(init);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to initialize upload');
	}
};
