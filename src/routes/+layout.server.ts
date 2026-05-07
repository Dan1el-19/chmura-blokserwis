import type { LayoutServerLoad } from './$types';
import { getUserRole } from '$lib/server/roles';
import { toPublicUser } from '$lib/server/public-user';

export const load: LayoutServerLoad = async ({ locals }) => {
	const role = locals.user ? getUserRole(locals.user) : null;

	return {
		user: toPublicUser(locals.user),
		role
	};
};
