import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { getUserRole } from '$lib/server/roles';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { mapRoleToUnisource } from '$lib/server/unisource-mappers';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';

export const PUT: RequestHandler = async (event) => {
	if (!event.locals.user || getUserRole(event.locals.user) !== 'admin') {
		throw error(403, 'Brak uprawnień');
	}

	const { role } = await event.request.json();
	if (!['basic', 'plus', 'admin'].includes(role)) {
		throw error(400, 'Nieprawidłowa rola');
	}

	try {
		const admin = createAdminUnisourceClient(event);
		await admin.admin.updateUserRole(event.params.userId, { role: mapRoleToUnisource(role) });
		return json({ success: true });
	} catch (e) {
		return unisourceErrorResponse(e, 'Failed to update user role');
	}
};
