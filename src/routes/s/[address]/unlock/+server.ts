import type { RequestHandler } from './$types';
import { privateResponseHeaders, publicError, shareApiUrl, shareGrantCookieName } from '#lib/server/share-proxy.js';

export const prerender = false;

export const POST: RequestHandler = async ({ params, request, fetch, cookies }) => {
	const address = params.address ?? '';
	try {
		const body = await request.json() as { password?: unknown; requestId?: unknown };
		if (typeof body.password !== 'string' || typeof body.requestId !== 'string') return publicError(400);
		const upstream = await fetch(shareApiUrl(address, '/unlock'), {
			method: 'POST',
			cache: 'no-store',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: body.password, requestId: body.requestId })
		});
		const result = await upstream.json().catch(() => null) as { ok?: boolean; grant?: string; expiresAt?: string } | null;
		if (!upstream.ok || !result?.ok || !result.grant || !result.expiresAt) {
			const headers = privateResponseHeaders('application/json; charset=utf-8');
			const retryAfter = upstream.headers.get('retry-after');
			if (retryAfter) headers.set('Retry-After', retryAfter);
			return new Response(JSON.stringify({ code: upstream.status === 429 ? 'RATE_LIMITED' : 'PASSWORD_INVALID' }), { status: upstream.status, headers });
		}
		const maxAge = Math.max(0, Math.floor((new Date(result.expiresAt).getTime() - Date.now()) / 1000));
		cookies.set(shareGrantCookieName(address), result.grant, {
			path: `/s/${address}`,
			httpOnly: true,
			secure: true,
			sameSite: 'lax',
			maxAge
		});
		return new Response(JSON.stringify({ ok: true, expiresAt: result.expiresAt }), {
			status: 200,
			headers: privateResponseHeaders('application/json; charset=utf-8')
		});
	} catch {
		return publicError(503);
	}
};
