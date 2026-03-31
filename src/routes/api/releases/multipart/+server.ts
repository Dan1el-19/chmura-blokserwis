import { ENV } from '$lib/server/env';
import { R2 } from '$lib/clients/r2';
import { CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { releaseUploadSchema } from '$lib/schemas';
import { getReleaseByName } from '$lib/server/storage/releases';

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

	const command = new CreateMultipartUploadCommand({
		Bucket: ENV.R2_BUCKET_NAME,
		Key: key,
		ContentType: type,
		Metadata: {
			uploadedBy: user.$id,
			originalName: filename
		}
	});

	const response = await R2.send(command);

	return json({
		key: response.Key,
		uploadId: response.UploadId,
		existingRelease: existing
	});
};
