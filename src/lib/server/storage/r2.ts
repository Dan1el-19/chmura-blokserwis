import { ENV } from '$lib/server/env';
import { R2 } from '$lib/clients/r2';
import { DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import contentDisposition from 'content-disposition';
import { getCached, setCache } from '../cache';
import { CacheKeys } from '../cache/keys';
import { UPLOAD } from '$lib/constants';

const DOWNLOAD_EXPIRES_IN = UPLOAD.DOWNLOAD_URL_EXPIRES_IN;

export async function deleteR2Object(key: string): Promise<void> {
	await R2.send(
		new DeleteObjectCommand({
			Bucket: ENV.R2_BUCKET_NAME,
			Key: key
		})
	);
}

export async function getDownloadUrl(key: string, filename: string): Promise<string> {
	const cacheKey = CacheKeys.downloadUrl(key);
	const cached = getCached<string>(cacheKey);
	if (cached) return cached;

	const url = await getSignedUrl(
		R2,
		new GetObjectCommand({
			Bucket: ENV.R2_BUCKET_NAME,
			Key: key,
			ResponseContentDisposition: contentDisposition(filename, { type: 'attachment' }),
			ResponseContentType: 'application/octet-stream'
		}),
		{ expiresIn: DOWNLOAD_EXPIRES_IN }
	);

	setCache(cacheKey, url);
	return url;
}
