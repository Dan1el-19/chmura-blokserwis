import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRelease, updateRelease, deleteRelease, listReleases } from '$lib/server/storage/releases';
import { updateReleaseSchema } from '$lib/schemas';
import { createAdminUnisourceClient } from '$lib/server/unisource';

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

	let release;
	try {
		release = await getRelease(releaseId, event);
	} catch {
		return json({ error: 'Release not found' }, { status: 404 });
	}

	try {
		await deleteRelease(releaseId, event);
	} catch {
		return json({ error: 'Failed to delete release' }, { status: 500 });
	}

	// If the deleted release had `latest`, promote it to the next most recent in the same channel
	const wasLatest = release.tags.includes('latest');
	if (wasLatest) {
		const channels = release.tags.filter((t) => t === 'stable' || t === 'beta');
		const channel = channels[0] ?? 'stable';

		const all = await listReleases(event);
		const next = all
			.filter(
				(r) =>
					r.$id !== releaseId &&
					r.tags.includes(channel)
			)
			.sort((a, b) => new Date(b.$createdAt).getTime() - new Date(a.$createdAt).getTime())[0];

		if (next) {
			const c = createAdminUnisourceClient(event);
			await c.releases.update(next.$id, { tags: Array.from(new Set([...next.tags, 'latest'])) });
		}
	}

	return json({ success: true });
};
