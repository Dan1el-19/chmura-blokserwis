import { json } from '@sveltejs/kit';
import { UnisourceError, UnisourceNetworkError } from '@unisource/sdk';

export function unisourceErrorResponse(error: unknown, fallback = 'UniSource request failed') {
	if (error instanceof UnisourceError) {
		return json(
			{ error: error.body?.message || error.message || fallback },
			{ status: error.status }
		);
	}

	if (error instanceof UnisourceNetworkError) {
		return json({ error: 'UniSource network request failed' }, { status: 502 });
	}

	return json({ error: error instanceof Error ? error.message : fallback }, { status: 500 });
}

export function publicShareErrorState(error: unknown) {
	if (error instanceof UnisourceError && [403, 410].includes(error.status)) {
		return {
			expired: error.status === 410,
			fileName: null,
			fileSize: null,
			mimeType: null,
			downloadUrl: null,
			expiresAt: null,
			requiresPassword: false,
			limitReached: error.status === 403,
			remainingDownloads: null
		};
	}

	return null;
}
