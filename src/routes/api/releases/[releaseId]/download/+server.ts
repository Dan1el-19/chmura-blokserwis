import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRelease } from '$lib/server/storage/releases';
import { getDownloadUrl } from '$lib/server/storage/r2';

export const GET: RequestHandler = async (event) => {
	const { releaseId } = event.params;

	let release;
	try {
		release = await getRelease(releaseId, event);
	} catch {
		return json({ error: 'Release not found' }, { status: 404 });
	}

	const downloadUrl = await getDownloadUrl(release.r2_key, release.name);
	return json({ downloadUrl });
};
