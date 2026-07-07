import { json } from '@sveltejs/kit';
import { UnisourceV2Error } from '@unisource/sdk/v2';
import type { RequestHandler } from './$types';
import { createUserUnisourceClient } from '$lib/server/unisource';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';
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

type FileItem = {
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

	const targetUserId = event.url.searchParams.get('targetUserId') || undefined;

	try {
		const client = await createUserUnisourceClient(event);
		const result = unwrapItem<PreviewUrlItem>(
			await client.userFiles.previewUrl(event.params.fileId, undefined, {
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
		if (isUnsupportedPreviewDestination(error)) {
			try {
				const client = await createUserUnisourceClient(event);
				const options = { asUser: targetUserId };
				const [file, download] = await Promise.all([
					client.userFiles.get(event.params.fileId, undefined, options),
					client.userFiles.downloadUrl(event.params.fileId, undefined, options)
				]);
				const fileItem = unwrapItem<FileItem>(file);
				const downloadItem = unwrapItem<DownloadUrlItem>(download);

				if (fileItem.storage_destination === 'appwrite' && canPreviewInline(fileItem.mime_type)) {
					return json({
						previewUrl: downloadItem.download_url,
						downloadUrl: downloadItem.download_url,
						expiresAt: downloadItem.expires_at,
						contentType: fileItem.mime_type,
						thumbnailUrl: null
					});
				}
			} catch (fallbackError) {
				console.error('[files/preview] Failed to build Appwrite preview fallback', {
					fileId: event.params.fileId,
					targetUserId,
					err: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
					status:
						fallbackError instanceof Error && 'status' in fallbackError
							? (fallbackError as any).status
							: undefined
				});
			}
		}

		console.error('[files/preview] Failed to get preview URL', {
			fileId: event.params.fileId,
			targetUserId,
			err: error instanceof Error ? error.message : String(error),
			status: error instanceof Error && 'status' in error ? (error as any).status : undefined
		});
		return unisourceErrorResponse(error, 'Failed to get preview URL');
	}
};
