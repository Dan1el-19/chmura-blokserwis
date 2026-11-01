import { PUBLIC_CLOUD_API_URL } from '$app/env/public';

export const shareGrantCookieName = (address: string) => `share_grant_${address}`;

export function shareApiUrl(address: string, suffix = ''): URL {
	const base = PUBLIC_CLOUD_API_URL || 'http://localhost:8787';
	return new URL(`/public/shares/${encodeURIComponent(address)}${suffix}`, base.endsWith('/') ? base : `${base}/`);
}

export function shareApiHeaders(grant?: string, requestId?: string): Headers {
	const headers = new Headers();
	if (grant) headers.set('X-Share-Grant', grant);
	if (requestId) headers.set('X-Request-ID', requestId);
	return headers;
}

export function privateResponseHeaders(contentType?: string): Headers {
	const headers = new Headers({
		'Cache-Control': 'no-store, private',
		'Referrer-Policy': 'no-referrer',
		'X-Robots-Tag': 'noindex, nofollow, noarchive',
		'X-Content-Type-Options': 'nosniff'
	});
	if (contentType) headers.set('Content-Type', contentType);
	return headers;
}

export function publicError(status: number): Response {
	const headers = privateResponseHeaders('application/json; charset=utf-8');
	return new Response(JSON.stringify({ code: status === 404 ? 'NOT_AVAILABLE' : 'UNAVAILABLE' }), { status, headers });
}
