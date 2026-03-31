import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import {
	getRelease,
	updateRelease,
	deleteRelease,
	getReleaseDownloadUrl
} from '$lib/server/storage/releases';
import { updateReleaseSchema } from '$lib/schemas';

export const GET: RequestHandler = async ({ params }) => {
	const { releaseId } = params;

	try {
		const { release, url } = await getReleaseDownloadUrl(releaseId);
		return json({ release, downloadUrl: url });
	} catch {
		return json({ error: 'Release not found' }, { status: 404 });
	}
};

export const PATCH: RequestHandler = async ({ params, request }) => {
	const { releaseId } = params;

	const body = await request.json();
	const validated = updateReleaseSchema.safeParse(body);

	if (!validated.success) {
		return json({ error: 'Validation error', details: validated.error.issues }, { status: 400 });
	}

	try {
		const release = await updateRelease(releaseId, validated.data);
		return json({ release });
	} catch {
		return json({ error: 'Release not found' }, { status: 404 });
	}
};

export const DELETE: RequestHandler = async ({ params }) => {
	const { releaseId } = params;

	try {
		await deleteRelease(releaseId);
		return json({ success: true });
	} catch {
		return json({ error: 'Release not found' }, { status: 404 });
	}
};
