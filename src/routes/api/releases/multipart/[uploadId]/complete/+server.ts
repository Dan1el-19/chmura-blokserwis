import { ENV } from '$lib/server/env';
import { R2 } from '$lib/clients/r2';
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

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

export const POST: RequestHandler = async ({ params, url, request }) => {
	const { uploadId } = params;
	const key = url.searchParams.get('key');
	const { parts } = await request.json();

	if (!key) {
		return json({ error: 'key query parameter is required' }, { status: 400 });
	}

	if (!Array.isArray(parts) || !parts.every(isValidPart)) {
		return json(
			{ error: 'parts must be an array of { PartNumber, ETag } objects' },
			{ status: 400 }
		);
	}

	const command = new CompleteMultipartUploadCommand({
		Bucket: ENV.R2_BUCKET_NAME,
		Key: key,
		UploadId: uploadId,
		MultipartUpload: {
			Parts: parts
		}
	});

	const response = await R2.send(command);

	return json({
		location: response.Location
	});
};
