import { json } from '@sveltejs/kit';
import { UnisourceV2Error } from '@unisource/sdk/v2';
import type { RequestHandler } from './$types';
import { createAdminUnisourceClient, requestAdminUnisourceV2 } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
import { getUserRole } from '$lib/server/roles';
import { unwrapItem } from '$lib/server/unisource-v2-contract';
import { canPreviewInline } from '$lib/utils/file-preview';

type PreviewUrlItem = {
	preview_url: string;
	download_url: string;
	expires_at: number;
	content_type: string;
	thumbnail_url?: string | null;
};

type DownloadUrlItem = {
	download_url: string;
	expires_at: number;
};

type MainFileItem = {
	upload_id: string | null;
	mime_type: string;
	storage_destination: 'r2' | 'appwrite';
};

function isUnsupportedPreviewDestination(error: unknown) {
	return (
		error instanceof UnisourceV2Error &&
		error.status === 409 &&
		error.code === 'unsupported_preview_destination'
	);
}

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
		if (isUnsupportedPreviewDestination(error)) {
			try {
				const file = unwrapItem<MainFileItem>(
					await requestAdminUnisourceV2(
						event,
						'GET',
						`/v2/main/${encodeURIComponent(event.params.fileId)}`
					)
				);

				if (
					file.storage_destination === 'appwrite' &&
					file.upload_id &&
					canPreviewInline(file.mime_type)
				) {
					const download = unwrapItem<DownloadUrlItem>(
						await createAdminUnisourceClient(event).adminFiles.downloadUrl(file.upload_id)
					);

					return json({
						previewUrl: download.download_url,
						downloadUrl: download.download_url,
						expiresAt: download.expires_at,
						contentType: file.mime_type,
						thumbnailUrl: null
					});
				}
			} catch (fallbackError) {
				console.error('[main/preview] Failed to build Appwrite preview fallback', {
					fileId: event.params.fileId,
					err: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
					status:
						fallbackError instanceof Error && 'status' in fallbackError
							? (fallbackError as any).status
							: undefined
				});
			}
		}

		console.error('[main/preview] Failed to get preview URL', {
			fileId: event.params.fileId,
			err: error instanceof Error ? error.message : String(error),
			status: error instanceof Error && 'status' in error ? (error as any).status : undefined
		});
		return unisourceErrorResponse(error, 'Failed to get preview URL');
	}
};
