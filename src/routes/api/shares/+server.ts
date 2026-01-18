import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createShare, listShares } from '$lib/server/storage/shares';
import { getFile } from '$lib/server/storage/files';

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	const fileId = url.searchParams.get('fileId');
	if (!fileId) return json({ error: 'Missing fileId' }, { status: 400 });

	try {
		// Verify ownership (or at least access)
		await getFile(fileId, locals.user.$id); // Throws if not owner
		const shares = await listShares(fileId);
		return json(shares);
	} catch (e) {
		console.error('List Shares Error:', e);
		return json({ error: 'Failed to list shares' }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ request, locals }) => {
	if (!locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await request.json();
		const { fileId, label, expiresAt, autoDelete, customSlug } = body;

		if (!fileId) return json({ error: 'Missing fileId' }, { status: 400 });

		// Verify ownership
		const file = await getFile(fileId, locals.user.$id);

		const share = await createShare(fileId, locals.user.$id, file.name, {
			label,
			expiresAt,
			autoDelete,
			customSlug
		});

		return json(share);
	} catch (e: any) {
		console.error('Create Share Error:', e);
		if (e.message.includes('already taken')) {
			return json({ error: e.message }, { status: 409 });
		}
		return json({ error: 'Failed to create share' }, { status: 500 });
	}
};
