import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { getUserRole } from '$lib/server/roles';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';

export const PUT: RequestHandler = async (event) => {
	if (!event.locals.user || getUserRole(event.locals.user) !== 'admin') {
		throw error(403, 'Brak uprawnień');
	}

	const { limit } = await event.request.json();

	try {
		const admin = createAdminUnisourceClient(event);
		await admin.admin.updateUser(event.params.userId, {
			max_storage_bytes: limit === null || limit === undefined ? null : Number(limit)
		});
		return json({ success: true });
	} catch (e) {
		return unisourceErrorResponse(e, 'Failed to update storage limit');
	}
};
