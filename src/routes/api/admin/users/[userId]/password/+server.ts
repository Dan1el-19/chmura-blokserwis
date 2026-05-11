import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { getUserRole } from '$lib/server/roles';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';

export const PUT: RequestHandler = async (event) => {
	if (!event.locals.user || getUserRole(event.locals.user) !== 'admin') {
		throw error(403, 'Brak uprawnień');
	}

	const { password } = await event.request.json();
	if (!password || password.length < 8) {
		throw error(400, 'Hasło musi mieć minimum 8 znaków');
	}

	try {
		const admin = createAdminUnisourceClient(event);
		await admin.admin.resetUserPassword(event.params.userId, { password });
		return json({ success: true });
	} catch (e) {
		return unisourceErrorResponse(e, 'Failed to reset password');
	}
};
