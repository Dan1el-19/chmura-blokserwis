import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { assertPresignedUrlMatchesR2Config } from '$lib/server/storage/r2-url';
import { requireRuntimeEnv } from '$lib/server/runtime-env';
import { unwrapItem } from '$lib/server/unisource-v2-contract';
import { multipartSignPartSchema } from '$lib/schemas';

/**
 * Proxy → UniSource `GET /upload/r2/multipart/sign-part`
 * Returns a short-lived presigned PUT URL for a single part.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const validated = multipartSignPartSchema.safeParse({
		upload_id: event.url.searchParams.get('upload_id'),
		part_number: event.url.searchParams.get('part_number')
	});
	if (!validated.success) {
		return json({ error: 'Validation failed', details: validated.error.issues }, { status: 400 });
	}
	const { upload_id: uploadId, part_number: partNumber } = validated.data;

	try {
		const client = await createUserUnisourceClient(event);
		const result = unwrapItem<{ url: string }>(
			await client.upload.multipartSignPart(uploadId, partNumber)
		);

		// Defence-in-depth: make sure the upstream presigned URL still points at
		// the R2 endpoint we expect. Prevents a misconfigured backend from
		// redirecting browsers to a foreign bucket.
		assertPresignedUrlMatchesR2Config(
			result.url,
			requireRuntimeEnv(event, 'R2_ENDPOINT'),
			requireRuntimeEnv(event, 'R2_BUCKET_NAME')
		);

		return json(result);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to sign upload part');
	}
};
