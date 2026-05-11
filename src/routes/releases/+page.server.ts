import type { PageServerLoad } from './$types';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { mapReleaseFromUnisource } from '$lib/server/unisource-mappers';

export const load: PageServerLoad = async (event) => {
	const admin = createAdminUnisourceClient(event);
	const response = await admin.releases.list({ limit: 100 });
	const releases = response.items.map(mapReleaseFromUnisource);
	return { releases };
};
