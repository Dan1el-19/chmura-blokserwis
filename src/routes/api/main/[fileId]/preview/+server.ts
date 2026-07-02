import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requestAdminUnisourceV2 } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { getUserRole } from '$lib/server/roles';
import { unwrapItem } from '$lib/server/unisource-v2-contract';

type PreviewUrlItem = {
	preview_url: string;
	download_url: string;
	expires_at: number;
	content_type: string;
	thumbnail_url?: string | null;
};

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	if (getUserRole(event.locals.user) === 'basic') {
		return json({ error: 'Forbidden' }, { status: 403 });
	}

	try {
		const result = unwrapItem<PreviewUrlItem>(
			await requestAdminUnisourceV2(
				event,
				'GET',
				`/v2/main/${encodeURIComponent(event.params.fileId)}/preview-url`
			)
		);

		return json({
			previewUrl: result.preview_url,
			downloadUrl: result.download_url,
			expiresAt: result.expires_at,
			contentType: result.content_type,
			thumbnailUrl: result.thumbnail_url ?? null
		});
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to get preview URL');
	}
};
