import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

import { createUserUnisourceClient } from '$lib/server/unisource';
import { mapShareLinkFromUnisource } from '$lib/server/unisource-mappers';
import { unisourceErrorResponse } from '$lib/server/unisource-errors';

function toUnixTimestamp(value: unknown): number | null | undefined {
	if (value === null) return null;
	if (typeof value !== 'string' || value.length === 0) return undefined;
	const timestamp = Math.floor(new Date(value).getTime() / 1000);
	return Number.isFinite(timestamp) ? timestamp : undefined;
}

export const PATCH: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const body = await event.request.json();
		const expiresAt = toUnixTimestamp(body.expiresAt);
		const client = await createUserUnisourceClient(event);
		const result = await client.shareLinks.update(event.params.shareId, {
			...(body.label !== undefined ? { name: body.label || null } : {}),
			...(body.isActive !== undefined ? { is_active: Boolean(body.isActive) } : {}),
			...(body.password !== undefined ? { password: body.password || null } : {}),
			...(expiresAt !== undefined ? { expires_at: expiresAt } : {}),
			...(body.maxDownloads !== undefined
				? { max_downloads: body.maxDownloads === null ? null : Number(body.maxDownloads) }
				: {})
		});

		return json(mapShareLinkFromUnisource(result.link));
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to update share');
	}
};

export const DELETE: RequestHandler = async (event) => {
	if (!event.locals.user) return json({ error: 'Unauthorized' }, { status: 401 });

	try {
		const client = await createUserUnisourceClient(event);
		await client.shareLinks.delete(event.params.shareId);
		return json({ success: true });
	} catch (error) {
		return unisourceErrorResponse(error, 'Failed to delete share');
	}
};
