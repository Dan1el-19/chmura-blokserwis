import { json } from '@sveltejs/kit';
import { UnisourceV2Error } from '@unisource/sdk/v2';

export function unisourceErrorResponse(error: unknown, fallback = 'UniSource request failed') {
	if (error instanceof UnisourceV2Error) {
		return json(
			{
				error: error.message || fallback,
				code: error.code,
				requestId: error.requestId
			},
			{ status: error.status }
		);
	}

	return json({ error: fallback }, { status: 500 });
}

export function publicShareErrorState(error: unknown) {
	if (error instanceof UnisourceV2Error && ['forbidden', 'gone'].includes(error.code)) {
		return {
			expired: error.code === 'gone',
			fileName: null,
			fileSize: null,
			mimeType: null,
			downloadUrl: null,
			expiresAt: null,
			requiresPassword: false,
			limitReached: error.code === 'forbidden',
			remainingDownloads: null
		};
	}

	return null;
}
