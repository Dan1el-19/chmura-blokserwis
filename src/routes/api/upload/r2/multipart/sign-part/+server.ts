import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { assertPresignedUrlMatchesR2Config } from '$lib/server/storage/r2-url';
import { requireRuntimeEnv } from '$lib/server/runtime-env';

/**
 * Proxy → UniSource `GET /upload/r2/multipart/sign-part`
 * Returns a short-lived presigned PUT URL for a single part.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const uploadId = event.url.searchParams.get('upload_id');
	const partNumberRaw = event.url.searchParams.get('part_number');

	if (!uploadId || !partNumberRaw) {
		return json({ error: 'Missing upload_id or part_number' }, { status: 400 });
	}

	const partNumber = Number(partNumberRaw);
	if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
		return json({ error: 'Invalid part_number' }, { status: 400 });
	}

	try {
		const client = await createUserUnisourceClient(event);
		const result = await client.upload.multipart.signPart(uploadId, partNumber);

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
