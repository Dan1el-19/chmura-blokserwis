import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { releaseUploadSchema } from '$lib/schemas';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { getReleaseByName } from '$lib/server/storage/releases';
import { z } from 'zod';
import { releaseTagSchema } from '$lib/schemas';
import { requireRuntimeEnv } from '$lib/server/runtime-env';
import { assertPresignedUrlMatchesR2Config } from '$lib/server/storage/r2-url';

const signSchema = releaseUploadSchema.extend({
	tags: z.array(releaseTagSchema).max(10).optional(),
	notes: z.string().max(2048).nullable().optional(),
	force_update: z.boolean().optional(),
	channel: z.enum(['stable', 'beta']).optional()
});

export const POST: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await event.request.json();
	const validated = signSchema.safeParse(body);

	if (!validated.success) {
		return json({ error: 'Validation error', details: validated.error.issues }, { status: 400 });
	}

	const { filename, type, overwrite, tags, notes, force_update, channel } = validated.data;

	const existing = await getReleaseByName(filename, event);
	if (existing && !overwrite) {
		return json(
			{ error: 'conflict', message: 'Release with this name already exists', existing },
			{ status: 409 }
		);
	}

	// Build tags: user-provided tags + channel tag (stable|beta), deduped
	const channelTag = channel ?? 'stable';
	const finalTags = Array.from(new Set([...(tags ?? []), channelTag]));

	const client = createAdminUnisourceClient(event);
	const init = await client.releases.upload.init({
		name: filename,
		filename,
		tags: finalTags,
		notes: notes ?? null,
		force_update: force_update ?? false
	});
	assertPresignedUrlMatchesR2Config(
		init.presigned_url,
		requireRuntimeEnv(event, 'R2_ENDPOINT'),
		requireRuntimeEnv(event, 'R2_BUCKET_NAME')
	);

	return json({
		url: init.presigned_url,
		method: 'PUT',
		headers: { 'content-type': type },
		key: init.r2_key,
		release_id: init.release_id,
		channel: channelTag,
		existingRelease: existing
	});
};
