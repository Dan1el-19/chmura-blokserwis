import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';

interface Part {
	PartNumber: number;
	ETag: string;
}

function isValidPart(part: unknown): part is Part {
	return (
		typeof part === 'object' &&
		part !== null &&
		'PartNumber' in part &&
		'ETag' in part &&
		typeof (part as Part).PartNumber === 'number' &&
		typeof (part as Part).ETag === 'string'
	);
}

/**
 * Proxy → UniSource `POST /releases/upload/multipart/complete`.
 * Finalises the multipart upload on R2 and marks the release as completed.
 * The release size is read server-side via HeadObject — no client-supplied
 * size is required here. Returns `{ success, release_id, status, location }`
 * for compatibility with the Uppy AwsS3 contract (`location` is optional).
 */
export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { uploadId } = event.params;
	if (!uploadId) {
		return json({ error: 'uploadId path param is required' }, { status: 400 });
	}

	const body = await event.request.json();
	const { parts } = body;

	if (!Array.isArray(parts) || !parts.every(isValidPart)) {
		return json(
			{ error: 'parts must be an array of { PartNumber, ETag } objects' },
			{ status: 400 }
		);
	}

	try {
		const client = createAdminUnisourceClient(event);
		const result = await client.releases.upload.multipart.complete({
			upload_id: uploadId,
			parts
		});
		return json(result);
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to complete multipart upload');
	}
};
