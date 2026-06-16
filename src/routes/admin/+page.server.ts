import type { PageServerLoad } from './$types';
import { createRequestAdminUnisourceClient } from '$lib/server/unisource';
import { mapRoleFromUnisource } from '$lib/server/unisource-mappers';

export const load: PageServerLoad = async (event) => {
	const admin = await createRequestAdminUnisourceClient(event);
	const [usage, users] = await Promise.all([
		admin.admin.getServiceUsage(),
		admin.admin.listUsers({ limit: 100 })
	]);

	const usersByRole = { basic: 0, plus: 0, admin: 0 };
	for (const user of users.items) {
		usersByRole[mapRoleFromUnisource(user.role)] += 1;
	}

	const stats = {
		totalUsers: users.total,
		usersByRole,
		totalStorage: usage.current_used_bytes
	};

	return { stats };
};
