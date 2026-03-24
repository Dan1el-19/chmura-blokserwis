import type { PageServerLoad } from './$types';
import { listReleases } from '$lib/server/storage/releases';

export const load: PageServerLoad = async () => {
	const releases = await listReleases();
	return { releases };
};
