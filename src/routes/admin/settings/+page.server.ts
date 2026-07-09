import { fail, redirect } from '@sveltejs/kit';
import type { RecommendedUploadDestination, Service } from '@unisource/sdk';
import { UnisourceV2Error } from '@unisource/sdk/v2';
import type { Actions, PageServerLoad } from './$types';

import { requestAdminUnisourceV2 } from '$lib/server/unisource';
import { unwrapItem } from '$lib/server/unisource-v2-contract';

type RecommendedDestination = RecommendedUploadDestination;

function isRecommendedDestination(value: unknown): value is RecommendedDestination {
	return value === 'r2' || value === 'appwrite' || value === 'hybrid';
}

export const load: PageServerLoad = async (event) => {
	if (!event.locals.user) {
		throw redirect(303, '/login');
	}

	// UniSource V2 wraps the resource in `item`, while the SDK client currently
	// expects a legacy `service` envelope. Use the raw request adapter shared by
	// the other admin routes to handle the deployed V2 contract.
	const service = unwrapItem<Service>(
		await requestAdminUnisourceV2<unknown>(event, 'GET', '/v2/admin/service')
	);
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
			await requestAdminUnisourceV2<unknown>(event, 'PATCH', '/v2/admin/service/settings', {
				body: { recommended_upload_destination: destination }
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
