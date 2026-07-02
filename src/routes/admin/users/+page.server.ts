import type { PageServerLoad } from './$types';
import type { AdminUsersListResponse } from '@unisource/sdk/v2';
import { requestAdminUnisourceV2 } from '$lib/server/unisource';
import { mapAdminUserFromUnisource } from '$lib/server/unisource-mappers';

export const load: PageServerLoad = async (event) => {
	const page = Math.max(1, parseInt(event.url.searchParams.get('page') || '1') || 1);
	const limit = 20;
	const offset = (page - 1) * limit;

	const usersList = await requestAdminUnisourceV2<AdminUsersListResponse>(
		event,
		'GET',
		'/v2/admin/users',
		{ query: { offset, limit } }
	);

	return {
		users: usersList.items.map(mapAdminUserFromUnisource),
		total: usersList.total,
		page,
		totalPages: Math.ceil(usersList.total / limit)
	};
};
