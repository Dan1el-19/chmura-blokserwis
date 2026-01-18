import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getShareByToken, getShareByTokenWithExpiredCheck } from '$lib/server/storage/shares';
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
					expiresAt: null
				};
			}
			error(404, 'Link nie istnieje.');
		}

		const file = await getFile(result.share.fileId, result.share.createdBy);
		const downloadUrl = await getDownloadUrl(file.r2Key, file.name);

		return {
			expired: false,
			fileName: file.name,
			fileSize: file.size,
			mimeType: file.mimeType,
			downloadUrl,
			expiresAt: result.share.expiresAt
		};
	} catch (e: any) {
		console.error('Error loading shared file:', e);
		if (e.status) throw e;
		error(404, 'Link nie istnieje.');
	}
};
