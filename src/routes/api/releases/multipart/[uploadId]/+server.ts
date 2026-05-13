import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';

/**
 * Proxy → UniSource `GET /releases/upload/multipart/list-parts`.
 * Returns the list of parts already uploaded so Uppy's Golden Retriever can
 * resume after a tab close. The response shape `[{ PartNumber, Size, ETag }]`
 * matches what `@uppy/aws-s3` expects.
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { uploadId } = event.params;
	if (!uploadId) {
		return json({ error: 'uploadId path param is required' }, { status: 400 });
	}

	try {
		const client = createAdminUnisourceClient(event);
		const result = await client.releases.upload.multipart.listParts(uploadId);
		return json(result.parts);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to list uploaded parts');
	}
};

/**
 * Proxy → UniSource `DELETE /releases/upload/multipart/abort`.
 * Aborts an in-flight multipart upload and marks the release as failed.
 */
export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { uploadId } = event.params;
	if (!uploadId) {
		return json({ error: 'uploadId path param is required' }, { status: 400 });
	}

	try {
		const client = createAdminUnisourceClient(event);
		await client.releases.upload.multipart.abort(uploadId);
		return json({});
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to abort multipart upload');
	}
};
