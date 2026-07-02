import { fail, redirect } from '@sveltejs/kit';
import type { RecommendedUploadDestination } from '@unisource/sdk';
import { UnisourceV2Error } from '@unisource/sdk/v2';
import type { Actions, PageServerLoad } from './$types';

import { createRequestAdminUnisourceClient } from '$lib/server/unisource';

type RecommendedDestination = RecommendedUploadDestination;

function isRecommendedDestination(value: unknown): value is RecommendedDestination {
	return value === 'r2' || value === 'appwrite' || value === 'hybrid';
}

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		throw redirect(303, '/login');
	}

	const client = await createRequestAdminUnisourceClient(event);
	const { service } = await client.admin.getService();
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
			const client = await createRequestAdminUnisourceClient(event);
			await client.admin.updateServiceSettings({
				recommended_upload_destination: destination
			});
			return { success: true, destination };
		} catch (error) {
			if (error instanceof UnisourceV2Error) {
				return fail(error.status, { error: error.message || 'Nie udało się zapisać' });
			}
			return fail(500, { error: 'Failed to update service settings' });
		}
	}
};
