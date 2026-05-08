import type { PageServerLoad } from './$types';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { mapAdminUserFromUnisource } from '$lib/server/unisource-mappers';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async (event) => {
	const { params } = event;
	const { userId } = params;

	const admin = createAdminUnisourceClient(event);

	try {
		const users = await admin.admin.listUsers({ search: userId, limit: 100 });
		const user = users.items.find((item) => item.id === userId);
		if (!user) throw error(404, 'Użytkownik nie został znaleziony');

		return {
			targetUser: mapAdminUserFromUnisource(user)
		};
	} catch (e) {
		if ((e as { status?: number }).status === 404) throw e;
		throw error(404, 'Użytkownik nie został znaleziony');
	}
};
