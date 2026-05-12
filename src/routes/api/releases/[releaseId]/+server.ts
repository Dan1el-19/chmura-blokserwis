import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRelease, updateRelease, deleteRelease } from '$lib/server/storage/releases';
import { updateReleaseSchema } from '$lib/schemas';

export const GET: RequestHandler = async (event) => {
	const { releaseId } = event.params;
	try {
		const release = await getRelease(releaseId, event);
		return json({ release });
	} catch {
		return json({ error: 'Release not found' }, { status: 404 });
	}
};

export const PATCH: RequestHandler = async (event) => {
	const { releaseId } = event.params;
	const body = await event.request.json();
	const validated = updateReleaseSchema.safeParse(body);

	if (!validated.success) {
		return json({ error: 'Validation error', details: validated.error.issues }, { status: 400 });
	}

	try {
		const release = await updateRelease(releaseId, validated.data, event);
		return json({ release });
	} catch {
		return json({ error: 'Release not found' }, { status: 404 });
	}
};

export const DELETE: RequestHandler = async (event) => {
	const { releaseId } = event.params;
	try {
		await getRelease(releaseId, event);
	} catch {
		return json({ error: 'Release not found' }, { status: 404 });
	}

	try {
		await deleteRelease(releaseId, event);
		return json({ success: true });
	} catch {
		return json({ error: 'Failed to delete release' }, { status: 500 });
	}
};
