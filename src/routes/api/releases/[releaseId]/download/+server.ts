import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getRelease } from '$lib/server/storage/releases';
import { getDownloadUrl } from '$lib/server/storage/r2';

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const { releaseId } = event.params;

	try {
		const release = await getRelease(releaseId, event);
		const downloadUrl = await getDownloadUrl(release.r2_key, release.name);
		return json({ downloadUrl });
	} catch {
		return json({ error: 'Failed to get download URL' }, { status: 500 });
	}
};
