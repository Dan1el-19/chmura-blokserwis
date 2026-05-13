import { ENV } from '$lib/server/env';
import { S3Client } from '@aws-sdk/client-s3';
import { assertR2Endpoint } from '$lib/server/storage/r2-url';

assertR2Endpoint(ENV.R2_ENDPOINT);

export const R2 = new S3Client({
	region: 'auto',
	endpoint: ENV.R2_ENDPOINT,
	requestChecksumCalculation: 'WHEN_REQUIRED',
	responseChecksumValidation: 'WHEN_REQUIRED',
	credentials: {
		accessKeyId: ENV.R2_ACCESS_KEY_ID,
		secretAccessKey: ENV.R2_SECRET_ACCESS_KEY
	}
});
