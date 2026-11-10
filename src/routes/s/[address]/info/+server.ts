import type { RequestHandler } from './$types';
import { privateResponseHeaders, publicError, shareApiHeaders, shareApiUrl, shareGrantCookieName } from '#lib/server/share-proxy.js';

export const prerender = false;

export const GET: RequestHandler = async ({ params, cookies, fetch, url }) => {
	const address = params.address ?? '';
	try {
		const upstreamUrl = shareApiUrl(address);
		const file = url.searchParams.get('file');
		if (file) upstreamUrl.searchParams.set('file', file);
		const upstream = await fetch(upstreamUrl, {
			cache: 'no-store',
			headers: shareApiHeaders(cookies.get(shareGrantCookieName(address)))
		});
		if (upstream.status === 404 && !file) cookies.delete(shareGrantCookieName(address), { path: `/s/${address}` });
		const contentType = upstream.headers.get('content-type') ?? 'application/json; charset=utf-8';
		return new Response(await upstream.text(), { status: upstream.status, headers: privateResponseHeaders(contentType) });
	} catch {
		return publicError(503);
	}
};
