import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
	getShareByTokenWithExpiredCheck,
	verifySharePassword,
	incrementDownloadCount,
	isDownloadLimitReached
} from '$lib/server/storage/shares';
import { getFile } from '$lib/server/storage/files';
import { getDownloadUrl } from '$lib/server/storage/r2';

export const load: PageServerLoad = async ({ params }) => {
	const { slug } = params;

	try {
		const result = await getShareByTokenWithExpiredCheck(slug);

		if (!result.share) {
			if (result.expired) {
				return {
					expired: true,
					fileName: null,
					fileSize: null,
					mimeType: null,
					downloadUrl: null,
					expiresAt: null,
					requiresPassword: false,
					limitReached: false,
					remainingDownloads: null
				};
			}
			error(404, 'Link nie istnieje.');
		}

		const share = result.share;

		if (!share.fileId) {
			error(501, 'Widok udostępniania folderów jest w przygotowaniu.');
		}

		if (isDownloadLimitReached(share)) {
			return {
				expired: false,
				fileName: null,
				fileSize: null,
				mimeType: null,
				downloadUrl: null,
				expiresAt: share.expiresAt,
				requiresPassword: false,
				limitReached: true,
				remainingDownloads: 0
			};
		}

		if (share.passwordHash) {
			const file = await getFile(share.fileId as string, share.createdBy);
			return {
				expired: false,
				fileName: file.name,
				fileSize: file.size,
				mimeType: file.mimeType,
				downloadUrl: null,
				expiresAt: share.expiresAt,
				requiresPassword: true,
				limitReached: false,
				remainingDownloads: share.maxDownloads
					? share.maxDownloads - share.downloadCount
					: null
			};
		}

		const file = await getFile(share.fileId as string, share.createdBy);
		const downloadUrl = await getDownloadUrl(file.r2Key, file.name);

		await incrementDownloadCount(share.$id);

		return {
			expired: false,
			fileName: file.name,
			fileSize: file.size,
			mimeType: file.mimeType,
			downloadUrl,
			expiresAt: share.expiresAt,
			requiresPassword: false,
			limitReached: false,
			remainingDownloads: share.maxDownloads
				? share.maxDownloads - share.downloadCount - 1
				: null
		};
	} catch (e: any) {
		console.error('Error loading shared file:', e);
		if (e.status) throw e;
		error(404, 'Link nie istnieje.');
	}
};

export const actions: Actions = {
	unlock: async ({ params, request }) => {
		const { slug } = params;
		const formData = await request.formData();
		const password = formData.get('password') as string;

		if (!password) {
			return fail(400, { error: 'Hasło jest wymagane' });
		}

		try {
			const result = await getShareByTokenWithExpiredCheck(slug);

			if (!result.share) {
				return fail(404, { error: 'Link nie istnieje' });
			}

			const share = result.share;

			if (!share.fileId) {
				return fail(501, { error: 'Widok udostępniania folderów jest w przygotowaniu.' });
			}

			if (isDownloadLimitReached(share)) {
				return fail(403, { error: 'Limit pobrań został wyczerpany' });
			}

			const valid = await verifySharePassword(share, password);
			if (!valid) {
				return fail(401, { error: 'Nieprawidłowe hasło' });
			}

			const file = await getFile(share.fileId as string, share.createdBy);
			const downloadUrl = await getDownloadUrl(file.r2Key, file.name);

			await incrementDownloadCount(share.$id);

			return {
				success: true,
				downloadUrl,
				remainingDownloads: share.maxDownloads
					? share.maxDownloads - share.downloadCount - 1
					: null
			};
		} catch (e: any) {
			console.error('Error unlocking share:', e);
			return fail(500, { error: 'Wystąpił błąd' });
		}
	}
};
