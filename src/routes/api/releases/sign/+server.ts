import { ENV } from '$lib/server/env';
import { R2 } from '$lib/clients/r2';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { releaseUploadSchema } from '$lib/schemas';
import { UPLOAD } from '$lib/constants';
import { getReleaseByName } from '$lib/server/storage/releases';

const EXPIRES_IN = UPLOAD.SIGNED_URL_EXPIRES_IN;

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const validated = releaseUploadSchema.safeParse(body);

	if (!validated.success) {
		return json({ error: 'Validation error', details: validated.error.issues }, { status: 400 });
	}

	const { filename, type, overwrite } = validated.data;

	// Check for existing release with same name
	const existing = await getReleaseByName(filename);
	if (existing && !overwrite) {
		return json(
			{
				error: 'conflict',
				message: 'Release with this name already exists',
				existing
			},
			{ status: 409 }
		);
	}

	// Key format: releases/{filename} (no UUID!)
	const key = `releases/${filename}`;

	const url = await getSignedUrl(
		R2,
		new PutObjectCommand({
			Bucket: ENV.R2_BUCKET_NAME,
			Key: key,
			ContentType: type,
			Metadata: {
				uploadedBy: user.$id,
				originalName: filename
			}
		}),
		{ expiresIn: EXPIRES_IN }
	);

	return json({
		url,
		method: 'PUT',
		headers: {
			'content-type': type
		},
		key,
		existingRelease: existing
	});
};
