import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import { getUserRole } from '$lib/server/roles';
import { toPublicUser } from '$lib/server/public-user';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (!locals.user) {
		throw redirect(303, '/login');
	}

	const role = getUserRole(locals.user);

	if (role !== 'admin') {
		throw redirect(303, '/');
	}

	return {
		user: toPublicUser(locals.user)
	};
};
