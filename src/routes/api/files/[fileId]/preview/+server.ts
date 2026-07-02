import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { unwrapItem } from '$lib/server/unisource-v2-contract';

type PreviewUrlItem = {
	preview_url: string;
	download_url: string;
	expires_at: number;
	content_type: string;
	thumbnail_url?: string | null;
};

type UserFilesWithPreview = {
	previewUrl: (id: string, signal?: AbortSignal, options?: { asUser?: string }) => Promise<unknown>;
};

export const GET: RequestHandler = async (event) => {
	if (!event.locals.user) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const targetUserId = event.url.searchParams.get('targetUserId') || undefined;

	try {
		const client = await createUserUnisourceClient(event);
		const userFiles = client.userFiles as typeof client.userFiles & UserFilesWithPreview;
		const result = unwrapItem<PreviewUrlItem>(
			await userFiles.previewUrl(event.params.fileId, undefined, {
				asUser: targetUserId
			})
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
