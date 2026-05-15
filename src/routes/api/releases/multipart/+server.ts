import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestHandler } from './$types';
import { releaseUploadSchema, releaseTagSchema } from '$lib/schemas';
import { getReleaseByName } from '$lib/server/storage/releases';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { releaseMultipart } from '$lib/server/release-multipart-client';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { logger } from '$lib/server/logger';

const multipartSchema = releaseUploadSchema.extend({
	tags: z.array(releaseTagSchema).max(10).optional(),
	notes: z.string().max(2048).nullable().optional(),
	force_update: z.boolean().optional()
});

/**
 * Proxy → UniSource `POST /releases/upload/multipart/create`.
 * Reserves a release_id, starts the R2 multipart upload via UniSource and
 * returns the Uppy AwsS3-compatible payload `{ key, uploadId, release_id }`.
 */
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

	try {
		const existing = await getReleaseByName(filename, event);
		if (existing && !overwrite) {
			return json(
				{ error: 'conflict', message: 'Release with this name already exists', existing },
				{ status: 409 }
			);
		}

		const client = createAdminUnisourceClient(event);
		const init = await releaseMultipart(client).create({
			name: filename,
			filename,
			mime_type: type,
			tags: tags ?? [],
			notes: notes ?? null,
			force_update: force_update ?? false
		});

		return json({
			key: init.key,
			uploadId: init.upload_id,
			release_id: init.upload_id,
			existingRelease: existing
		});
	} catch (error) {
		logger.error('Failed to create release multipart upload:', error);
		return unisourceErrorResponse(error, 'Failed to create multipart upload');
	}
};
