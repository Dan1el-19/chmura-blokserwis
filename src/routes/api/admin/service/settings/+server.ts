import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { getUserRole } from '$lib/server/roles';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';

/**
 * Proxy → UniSource `PATCH /admin/service/settings`
 * Toggles the recommended upload destination (R2 / Appwrite / hybrid) for the split-button UI.
 * Admin-only.
 */
export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.user || getUserRole(event.locals.user) !== 'admin') {
		throw error(403, 'Brak uprawnień');
	}

	let body: { recommended_upload_destination?: unknown };
	try {
		body = await event.request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const destination = body.recommended_upload_destination;
	if (destination !== 'r2' && destination !== 'appwrite' && destination !== 'hybrid') {
		return json(
			{ error: 'recommended_upload_destination must be r2, appwrite, or hybrid' },
			{ status: 400 }
		);
	}

	try {
		const client = createAdminUnisourceClient(event);
		const result = await client.admin.updateServiceSettings({
			recommended_upload_destination: destination
		});
		return json(result);
	} catch (e) {
		return unisourceErrorResponse(e, 'Failed to update service settings');
	}
};
