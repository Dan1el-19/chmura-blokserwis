import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

import { createAdminUnisourceClient } from '$lib/server/unisource';
import {
	UnisourceError,
	UnisourceNetworkError,
	type RecommendedUploadDestination
} from '@unisource/sdk';

type RecommendedDestination = RecommendedUploadDestination;

function isRecommendedDestination(value: unknown): value is RecommendedDestination {
	return value === 'r2' || value === 'appwrite' || value === 'hybrid';
}

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		throw redirect(303, '/login');
	}

	const client = createAdminUnisourceClient(event);
	const { service } = await client.admin.serviceDetail();
	const dest: RecommendedDestination = isRecommendedDestination(
		service.recommended_upload_destination
	)
		? service.recommended_upload_destination
		: 'r2';

	return {
		service: {
			id: service.id,
			name: service.name,
			recommended_upload_destination: dest
		}
	};
};

export const actions: Actions = {
	updateSettings: async (event) => {
		if (!event.locals.user) {
			return fail(401, { error: 'Brak autoryzacji' });
		}

		const formData = await event.request.formData();
		const destination = formData.get('recommended_upload_destination');

		if (!isRecommendedDestination(destination)) {
			return fail(400, { error: 'Nieprawidłowe miejsce docelowe' });
		}

		try {
			const client = createAdminUnisourceClient(event);
			await client.admin.updateServiceSettings({
				recommended_upload_destination: destination
			});
			return { success: true, destination };
		} catch (error) {
			if (error instanceof UnisourceError) {
				return fail(error.status, { error: error.body?.message || 'Nie udało się zapisać' });
			}
			if (error instanceof UnisourceNetworkError) {
				return fail(502, { error: 'Żądanie sieciowe do UniSource nie powiodło się' });
			}
			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to update service settings'
			});
		}
	}
};
