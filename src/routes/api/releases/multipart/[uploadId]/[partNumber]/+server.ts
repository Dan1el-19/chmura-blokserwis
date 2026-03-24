import { ENV } from '$lib/server/env';
import { R2 } from '$lib/clients/r2';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const EXPIRES_IN = 900;

function isValidPartNumber(partNumber: number): boolean {
	return Number.isInteger(partNumber) && partNumber >= 1 && partNumber <= 10000;
}

export const GET: RequestHandler = async ({ params, url }) => {
	const { uploadId, partNumber: partNumberStr } = params;
	const key = url.searchParams.get('key');
	const partNumber = Number(partNumberStr);

	if (!isValidPartNumber(partNumber)) {
		return json({ error: 'partNumber must be an integer between 1 and 10000' }, { status: 400 });
	}

	if (!key) {
		return json({ error: 'key query parameter is required' }, { status: 400 });
	}

	const command = new UploadPartCommand({
		Bucket: ENV.R2_BUCKET_NAME,
		Key: key,
		UploadId: uploadId,
		PartNumber: partNumber
	});

	const signedUrl = await getSignedUrl(R2, command, { expiresIn: EXPIRES_IN });

	return json({
		url: signedUrl,
		expires: EXPIRES_IN
	});
};
