import { json } from '@sveltejs/kit';
import type { RequestEvent } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { getUserRole } from '$lib/server/roles';
import { requireRuntimeEnv } from '$lib/server/runtime-env';
import { assertPresignedUrlMatchesR2Config } from '$lib/server/storage/r2-url';
import { unwrapItem } from '$lib/server/unisource-v2-contract';
import { uploadInitSchema } from '$lib/schemas';

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
		const validated = uploadInitSchema.safeParse(body);
		if (!validated.success) {
			return json({ error: 'Validation failed', details: validated.error.issues }, { status: 400 });
		}
		const { filename, size, mime_type, is_main_storage, folder_id } = validated.data;
		const client = await createUserUnisourceClient(event);
		if (is_main_storage) {
			if (getUserRole(event.locals.user) === 'basic') {
				return json({ error: 'Forbidden' }, { status: 403 });
			}
			const init = unwrapItem<{ presigned_url: string }>(
				await client.upload.r2Init({
					filename,
					size,
					mime_type,
					is_main_storage: true,
					...(folder_id ? { folder_id } : {})
				})
			);
			assertUploadUsesConfiguredR2(init.presigned_url, event);
			return json(init);
		}

		const init = unwrapItem<{ presigned_url: string }>(
			await client.upload.r2Init({
				filename,
				size,
				mime_type,
				is_main_storage: false,
				...(folder_id ? { folder_id } : {})
			})
		);
		assertUploadUsesConfiguredR2(init.presigned_url, event);
		return json(init);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to initialize upload');
	}
};
