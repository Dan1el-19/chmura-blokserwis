import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createAdminUnisourceClient } from '$lib/server/unisource';
import { UnisourceError, UnisourceNetworkError } from '@unisource/sdk';

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		throw redirect(303, '/login');
	}

	const client = createAdminUnisourceClient(event);
	const { service } = await client.admin.serviceDetail();

	return {
		service: {
			id: service.id,
			name: service.name,
			recommended_upload_destination: service.recommended_upload_destination ?? 'r2'
		}
	};
};

export const actions: Actions = {
	updateSettings: async (event) => {
		if (!event.locals.user) {
			return fail(401, { error: 'Unauthorized' });
		}

		const formData = await event.request.formData();
		const destination = formData.get('recommended_upload_destination');

		if (destination !== 'r2' && destination !== 'appwrite') {
			return fail(400, { error: 'Invalid destination' });
		}

		try {
			const client = createAdminUnisourceClient(event);
			await client.admin.updateServiceSettings({
				recommended_upload_destination: destination
			});
			return { success: true, destination };
		} catch (error) {
			if (error instanceof UnisourceError) {
				return fail(error.status, { error: error.body?.message || 'Failed to save' });
			}
			if (error instanceof UnisourceNetworkError) {
				return fail(502, { error: 'UniSource network request failed' });
			}
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to update service settings'
			});
		}
	}
};
