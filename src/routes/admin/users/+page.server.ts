import type { PageServerLoad } from './$types';
import { createRequestAdminUnisourceClient } from '$lib/server/unisource';
import { mapAdminUserFromUnisource } from '$lib/server/unisource-mappers';

export const load: PageServerLoad = async (event) => {
	const page = Math.max(1, parseInt(event.url.searchParams.get('page') || '1') || 1);
	const limit = 20;
	const offset = (page - 1) * limit;

	const admin = await createRequestAdminUnisourceClient(event);
	const usersList = await admin.admin.listUsers({ offset, limit });

	return {
		users: usersList.items.map(mapAdminUserFromUnisource),
		total: usersList.total,
		page,
		totalPages: Math.ceil(usersList.total / limit)
	};
};
