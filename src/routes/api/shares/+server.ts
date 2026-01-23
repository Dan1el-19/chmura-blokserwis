import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createShare, listShares } from '$lib/server/storage/shares';
import { getFile } from '$lib/server/storage/files';
import { getFolder } from '$lib/server/storage/folders';
import type { ShareType } from '$lib/types/storage';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const fileId = url.searchParams.get('fileId');
	const folderId = url.searchParams.get('folderId');

	if (!fileId && !folderId) {
		return json({ error: 'Missing fileId or folderId' }, { status: 400 });
	}

	try {
		if (fileId) {
			await getFile(fileId, locals.user.$id);
			const shares = await listShares({ fileId });
			return json(shares);
		} else if (folderId) {
			await getFolder(folderId, locals.user.$id);
			const shares = await listShares({ folderId });
			return json(shares);
		}

		return json({ error: 'Invalid request' }, { status: 400 });
	} catch (e) {
		console.error('List Shares Error:', e);
		return json({ error: 'Failed to list shares' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json();
		const {
			fileId,
			folderId,
			shareType,
			label,
			expiresAt,
			autoDelete,
			customSlug,
			password,
			maxDownloads
		} = body;

		if (!fileId && !folderId) {
			return json({ error: 'Missing fileId or folderId' }, { status: 400 });
		}

		if (fileId && folderId) {
			return json({ error: 'Cannot share both file and folder at once' }, { status: 400 });
		}

		let name: string;

		if (fileId) {
			const file = await getFile(fileId, locals.user.$id);
			name = file.name;
		} else {
			const folder = await getFolder(folderId, locals.user.$id);
			name = folder.name;
		}

		const share = await createShare(locals.user.$id, name, {
			fileId: fileId || null,
			folderId: folderId || null,
			shareType: shareType as ShareType,
			label,
			expiresAt,
			autoDelete,
			customSlug,
			password,
			maxDownloads
		});

		return json(share);
	} catch (e: any) {
		console.error('Create Share Error:', e);
		if (e.message?.includes('already taken')) {
			return json({ error: e.message }, { status: 409 });
		}
		if (e.message?.includes('Access denied')) {
			return json({ error: 'Access denied' }, { status: 403 });
		}
		return json({ error: 'Failed to create share' }, { status: 500 });
	}
};
