import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteShare, getShareByToken } from '$lib/server/storage/shares';
// We need getShareById actually, but deleteShare works with ID.
// However we need to check permissions.
// getShareByToken takes token.
// listShares filtered by fileId.
// We should check if the user calling delete owns the file associated with share.
// But we don't have getShareById exposed yet.

import { createAdminClient } from '$lib/server/appwrite';
import { DATABASE } from '$lib/constants';

export const DELETE: RequestHandler = async ({ params, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const shareId = params.shareId!;
	// To check permission, we need to know the creator or the file owner.
	// Let's just create a helper in shares.ts or do raw query here?
	// Better to use a helper in shares.ts to get share by ID.
	// For now, I'll trust the deleteShare if I can verify ownership logic.
	// But shares.ts `deleteShare` is just admin delete.

	// I should add `getShare` to shares.ts
	// For now, I'll do a quick lookup here using admin client to check ownership.

	const { tablesDB } = createAdminClient();
	try {
		const share = await tablesDB.getRow({
			databaseId: DATABASE.ID,
			tableId: DATABASE.TABLES.FILE_SHARES,
			rowId: shareId
		});

		if (share.createdBy !== locals.user.$id) {
			return json({ error: 'Forbidden' }, { status: 403 });
		}

		await deleteShare(shareId);
		return json({ success: true });
	} catch (e: any) {
		if (e.code === 404) return json({ error: 'Not found' }, { status: 404 });
		return json({ error: 'Failed' }, { status: 500 });
	}
};
