import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { assertPresignedUrlMatchesR2Config } from '$lib/server/storage/r2-url';
import { requireRuntimeEnv } from '$lib/server/runtime-env';

const EXPIRES_IN = 900;

function isValidPartNumber(partNumber: number): boolean {
	return Number.isInteger(partNumber) && partNumber >= 1 && partNumber <= 10000;
}

/**
 * Proxy → UniSource `GET /releases/upload/multipart/sign-part`.
 * Returns a presigned PUT URL for a single part of an in-flight multipart
 * release upload. Defence-in-depth: validates the upstream presigned URL still
 * targets the configured R2 bucket.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { uploadId, partNumber: partNumberStr } = event.params;
	const partNumber = Number(partNumberStr);

	if (!isValidPartNumber(partNumber)) {
		return json({ error: 'partNumber must be an integer between 1 and 10000' }, { status: 400 });
	}

	if (!uploadId) {
		return json({ error: 'uploadId path param is required' }, { status: 400 });
	}

	try {
		const client = createAdminUnisourceClient(event);
		const result = await client.releases.upload.multipart.signPart(uploadId, partNumber);

		assertPresignedUrlMatchesR2Config(
			result.url,
			requireRuntimeEnv(event, 'R2_ENDPOINT'),
			requireRuntimeEnv(event, 'R2_BUCKET_NAME')
		);

		return json({ url: result.url, expires: EXPIRES_IN });
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to sign upload part');
	}
};
