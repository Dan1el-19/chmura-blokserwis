import type { RequestHandler } from './$types';
import { privateResponseHeaders, shareApiHeaders, shareApiUrl, shareGrantCookieName } from '#lib/server/share-proxy.js';

export const prerender = false;

function downloadError(status: number, address: string): Response {
	const temporary = status >= 500;
	const limitReached = status === 410;
	const requestExpired = status === 409;
	const message = limitReached
		? 'Limit pobrań dla tego linku został wyczerpany.'
		: requestExpired
		? 'To żądanie pobrania wygasło. Odśwież stronę i rozpocznij pobieranie ponownie.'
		: temporary
		? 'Nie udało się teraz przygotować pobierania. Spróbuj ponownie później.'
		: 'Ten link wygasł, został unieważniony albo plik znajduje się w koszu.';
	return new Response(
		`<!doctype html><html lang="pl"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>${limitReached ? 'Limit pobrań wyczerpany' : requestExpired ? 'Żądanie pobrania wygasło' : 'Plik niedostępny'}</title><body style="font:16px system-ui,sans-serif;max-width:38rem;margin:15vh auto;padding:1.5rem;color:#202938"><h1>${limitReached ? 'Limit pobrań wyczerpany' : requestExpired ? 'Żądanie pobrania wygasło' : temporary ? 'Pobieranie chwilowo niedostępne' : 'Plik jest niedostępny'}</h1><p>${message}</p><a href="/s/${encodeURIComponent(address)}">Wróć do udostępnionego pliku</a></body></html>`,
		{
			status,
			headers: {
				'Cache-Control': 'no-store, private',
				'Content-Type': 'text/html; charset=utf-8',
				'Referrer-Policy': 'no-referrer',
				'X-Robots-Tag': 'noindex, nofollow, noarchive',
				'X-Content-Type-Options': 'nosniff'
			}
		}
	);
}

async function redirectToDownload(address: string, requestId: string, grant: string | undefined, fetch: typeof globalThis.fetch): Promise<Response> {
	try {
		const response = await fetch(shareApiUrl(address, '/download'), {
			method: 'GET',
			redirect: 'manual',
			cache: 'no-store',
			referrerPolicy: 'no-referrer',
			headers: shareApiHeaders(grant, requestId)
		});
		const headers = privateResponseHeaders();
		const location = response.headers.get('location');
		if (response.status === 302 && location) {
			headers.set('Location', location);
			return new Response(null, { status: 302, headers });
		}
		if (response.status === 401) {
			headers.set('Location', `/s/${encodeURIComponent(address)}`);
			return new Response(null, { status: 303, headers });
		}
		if (response.status === 410) return downloadError(410, address);
		if (response.status === 409) return downloadError(409, address);
		return downloadError(response.status >= 500 ? response.status : 404, address);
	} catch {
		return downloadError(503, address);
	}
}

export const GET: RequestHandler = async ({ params, cookies, request, fetch }) => {
	const address = params.address ?? '';
	return redirectToDownload(
		address,
		request.headers.get('x-request-id') || crypto.randomUUID(),
		cookies.get(shareGrantCookieName(address)),
		fetch
	);
};

export const POST: RequestHandler = async ({ params, cookies, request, fetch }) => {
	const address = params.address ?? '';
	const form = await request.formData().catch(() => null);
	const suppliedId = form?.get('requestId');
	const requestId = typeof suppliedId === 'string' && suppliedId.length >= 8 && suppliedId.length <= 100
		? suppliedId
		: crypto.randomUUID();
	return redirectToDownload(address, requestId, cookies.get(shareGrantCookieName(address)), fetch);
};
