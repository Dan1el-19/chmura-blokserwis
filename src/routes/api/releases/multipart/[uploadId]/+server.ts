import { ENV } from '$lib/server/env';
import { R2 } from '$lib/clients/r2';
import { ListPartsCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url }) => {
	const { uploadId } = params;
	const key = url.searchParams.get('key');

	if (!key) {
		return json({ error: 'key query parameter is required' }, { status: 400 });
	}

	const parts: { PartNumber: number; Size: number; ETag: string }[] = [];
	let partNumberMarker: string | undefined;

	do {
		const command = new ListPartsCommand({
			Bucket: ENV.R2_BUCKET_NAME,
			Key: key,
			UploadId: uploadId,
			PartNumberMarker: partNumberMarker
		});

		const response = await R2.send(command);

		if (response.Parts) {
			for (const part of response.Parts) {
				if (part.PartNumber && part.Size && part.ETag) {
					parts.push({
						PartNumber: part.PartNumber,
						Size: part.Size,
						ETag: part.ETag
					});
				}
			}
		}

		if (response.IsTruncated) {
			partNumberMarker = String(response.NextPartNumberMarker);
		} else {
			break;
		}
	} while (true);

	return json(parts);
};

export const DELETE: RequestHandler = async ({ params, url }) => {
	const { uploadId } = params;
	const key = url.searchParams.get('key');

	if (!key) {
		return json({ error: 'key query parameter is required' }, { status: 400 });
	}

	const command = new AbortMultipartUploadCommand({
		Bucket: ENV.R2_BUCKET_NAME,
		Key: key,
		UploadId: uploadId
	});

	await R2.send(command);

	return json({});
};
