import type { RequestHandler } from './$types';
import { privateResponseHeaders, publicError, shareApiUrl } from '#lib/server/share-proxy.js';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request, fetch }) => {
	try {
		const body = await request.json() as { viewId?: unknown };
		if (typeof body.viewId !== 'string' || body.viewId.length < 8 || body.viewId.length > 100)
			return publicError(400);
		const upstream = await fetch(shareApiUrl(params.address ?? '', '/visit'), {
			method: 'POST',
			cache: 'no-store',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ viewId: body.viewId })
		});
		return new Response(await upstream.text(), { status: upstream.status, headers: privateResponseHeaders('application/json; charset=utf-8') });
	} catch {
		return publicError(503);
	}
};
