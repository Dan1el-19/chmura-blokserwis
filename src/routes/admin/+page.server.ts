import type { PageServerLoad } from './$types';
import type { AdminUsersListResponse, AdminServiceUsageResponse } from '@unisource/sdk/v2';
import { requestAdminUnisourceV2 } from '$lib/server/unisource';
import { mapRoleFromUnisource } from '$lib/server/unisource-mappers';
import { unwrapItem } from '$lib/server/unisource-v2-contract';

type UsageEnvelope = AdminServiceUsageResponse | { item: AdminServiceUsageResponse };

export const load: PageServerLoad = async (event) => {
	const [usageResponse, users] = await Promise.all([
		requestAdminUnisourceV2<UsageEnvelope>(event, 'GET', '/v2/admin/service/usage'),
		requestAdminUnisourceV2<AdminUsersListResponse>(event, 'GET', '/v2/admin/users', {
			query: { limit: 100 }
		})
	]);
	const usage = 'item' in usageResponse ? unwrapItem<AdminServiceUsageResponse>(usageResponse) : usageResponse;

	const usersByRole = { basic: 0, plus: 0, admin: 0 };
	for (const user of users.items) {
		usersByRole[mapRoleFromUnisource(user.role)] += 1;
	}

	const stats = {
		totalUsers: users.total,
		usersByRole,
		totalStorage: usage.current_used_bytes,
		storageByDestination: {
			r2: usage.r2_used_bytes,
			appwrite: usage.appwrite_used_bytes
		}
	};

	return { stats };
};
