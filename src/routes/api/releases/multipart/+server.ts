import { ENV } from '$lib/server/env';
import { R2 } from '$lib/clients/r2';
import { CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { releaseUploadSchema, releaseTagSchema } from '$lib/schemas';
import { getReleaseByName } from '$lib/server/storage/releases';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { logger } from '$lib/server/logger';
import { z } from 'zod';

const multipartSchema = releaseUploadSchema.extend({
	tags: z.array(releaseTagSchema).max(10).optional(),
	notes: z.string().max(2048).nullable().optional(),
	force_update: z.boolean().optional()
});

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await event.request.json();
	const validated = multipartSchema.safeParse(body);

	if (!validated.success) {
		return json({ error: 'Validation error', details: validated.error.issues }, { status: 400 });
	}

	const { filename, type, overwrite, tags, notes, force_update } = validated.data;

	const client = createAdminUnisourceClient(event);
	let releaseId: string | undefined;

	try {
		const existing = await getReleaseByName(filename, event);
		if (existing && !overwrite) {
			return json(
				{ error: 'conflict', message: 'Release with this name already exists', existing },
				{ status: 409 }
			);
		}

		const init = await client.releases.upload.init({
			name: filename,
			filename,
			tags: tags ?? [],
			notes: notes ?? null,
			force_update: force_update ?? false
		});
		releaseId = init.release_id;

		const command = new CreateMultipartUploadCommand({
			Bucket: ENV.R2_BUCKET_NAME,
			Key: init.r2_key,
			ContentType: type,
			Metadata: { uploadedBy: event.locals.user.$id, originalName: filename }
		});

		const response = await R2.send(command);

		return json({
			key: response.Key,
			uploadId: response.UploadId,
			release_id: init.release_id,
			existingRelease: existing
		});
	} catch (error) {
		if (releaseId) {
			await Promise.resolve(client.releases.upload.fail(releaseId)).catch((failError: unknown) => {
				logger.error('Failed to mark release upload as failed:', failError);
			});
		}

		logger.error('Failed to create release multipart upload:', error);
		return unisourceErrorResponse(error, 'Failed to create multipart upload');
	}
};
