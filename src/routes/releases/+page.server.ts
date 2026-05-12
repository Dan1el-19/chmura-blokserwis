import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listReleases } from '$lib/server/storage/releases';
import { getUserRole } from '$lib/server/roles';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user || getUserRole(event.locals.user) !== 'admin') {
		throw redirect(303, '/');
	}
	const releases = await listReleases(event);
	return { releases };
};
