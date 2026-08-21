import type { LayoutServerLoad } from './$types';
import { getUserRole } from '$lib/server/roles';
import { toPublicUser } from '$lib/server/public-user';
import { requestAdminUnisourceV2 } from '$lib/server/unisource';
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
			// Keep this small bootstrap call tolerant during rolling SDK/backend
			// deployments: the V2 backend historically returned `{ item }`, while
			// newer SDKs expose `{ service }`.
			const response = await requestAdminUnisourceV2<{
				service?: { recommended_upload_destination?: unknown };
				item?: { recommended_upload_destination?: unknown };
			}>(event, 'GET', '/v2/admin/service');
			const service = response.service ?? response.item;
			const v = service?.recommended_upload_destination;
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
