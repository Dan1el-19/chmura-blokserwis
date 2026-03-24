import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listReleases, createRelease, getReleaseByName, deleteRelease } from '$lib/server/storage/releases';
import { createReleaseSchema } from '$lib/schemas';
import { deleteR2Object } from '$lib/server/storage/r2';

export const GET: RequestHandler = async () => {
	const releases = await listReleases();
	return json({ releases });
};

export const POST: RequestHandler = async ({ request, locals }) => {
	const user = locals.user;
	if (!user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const body = await request.json();
	const validated = createReleaseSchema.safeParse(body);

	if (!validated.success) {
		return json(
			{ error: 'Validation error', details: validated.error.issues },
			{ status: 400 }
		);
	}

	const { name, size, r2Key, tags, notes } = validated.data;

	// Check if release with same name exists and overwrite flag is set
	const existing = await getReleaseByName(name);
	if (existing && !body.overwrite) {
		return json(
			{
				error: 'conflict',
				message: 'Release with this name already exists',
				existing
			},
			{ status: 409 }
		);
	}

	// If overwriting, delete old release first but keep the R2 object (since it was just overwritten)
	if (existing && body.overwrite) {
		await deleteRelease(existing.$id, true);
	}

	const release = await createRelease({
		name,
		size,
		r2Key,
		tags,
		uploadedBy: user.$id,
		notes
	});

	return json({ release }, { status: 201 });
};
