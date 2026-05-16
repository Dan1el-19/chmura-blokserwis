import type { LayoutServerLoad } from './$types';
import { getUserRole } from '$lib/server/roles';
import { toPublicUser } from '$lib/server/public-user';
import { createAdminUnisourceClient } from '$lib/server/unisource';
import { logger } from '$lib/server/logger';
import type { RecommendedUploadDestination } from '@unisource/sdk';

function isRecommendedUploadDestination(value: unknown): value is RecommendedUploadDestination {
	return value === 'r2' || value === 'appwrite' || value === 'hybrid';
}

export const load: LayoutServerLoad = async (event) => {
	const role = event.locals.user ? getUserRole(event.locals.user) : null;

	// Expose the service's recommended upload destination so the split-button
	// UI can render the correct primary action without requiring another
	// client-side fetch. Falls back to 'r2' if the call fails.
	let recommendedUploadDestination: RecommendedUploadDestination = 'r2';
	if (event.locals.user) {
		try {
			const client = createAdminUnisourceClient(event);
			const { service } = await client.admin.serviceDetail();
			const v = service.recommended_upload_destination;
			if (isRecommendedUploadDestination(v)) {
				recommendedUploadDestination = v;
			}
		} catch (error) {
			logger.error('Failed to fetch service recommended upload destination:', error);
		}
	}

	return {
		user: toPublicUser(event.locals.user),
		role,
		recommendedUploadDestination
	};
};
