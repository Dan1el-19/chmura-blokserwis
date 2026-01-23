import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteShare, getShareById } from '$lib/server/storage/shares';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const shareId = params.shareId!;

	try {
		const share = await getShareById(shareId);

		if (!share) {
			return json({ error: 'Not found' }, { status: 404 });
		}

		if (share.createdBy !== locals.user.$id) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		await deleteShare(shareId);
		return json({ success: true });
	} catch (e: any) {
		return json({ error: 'Failed' }, { status: 500 });
	}
};
