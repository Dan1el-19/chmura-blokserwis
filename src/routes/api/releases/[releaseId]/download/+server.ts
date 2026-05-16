import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRelease } from '$lib/server/storage/releases';
import { R2 } from '$lib/clients/r2';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ENV } from '$lib/server/env';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });
	const { releaseId } = event.params;
	try {
		const release = await getRelease(releaseId, event);
		const command = new GetObjectCommand({
			Bucket: ENV.R2_BUCKET_NAME,
			Key: release.r2_key
		});
		const downloadUrl = await getSignedUrl(R2, command, { expiresIn: 3600 });
		return json({ downloadUrl });
	} catch {
		return json({ error: 'Failed to get download URL' }, { status: 500 });
	}
};
