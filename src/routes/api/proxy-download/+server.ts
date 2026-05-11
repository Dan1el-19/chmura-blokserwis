import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
	const targetUrl = url.searchParams.get('url');
	const filename = url.searchParams.get('name');

	if (!targetUrl || !filename) {
		throw error(400, 'Brak wymaganego parametru url lub name');
	}

	try {
		const parsedUrl = new URL(targetUrl);
		if (parsedUrl.protocol !== 'https:') {
			throw error(400, 'Niedozwolony protokół URL');
		}

		// Basic SSRF protection
		const hostname = parsedUrl.hostname;
		if (
			hostname === 'localhost' ||
			hostname.startsWith('127.') ||
			hostname.startsWith('10.') ||
			hostname.startsWith('192.168.') ||
			hostname.match(/^172\.(1[6-9]|2[0-9]|3[0-1])\./)
		) {
			throw error(400, 'Niedozwolony host URL');
		}

		const response = await fetch(targetUrl);

		if (!response.ok) {
			throw error(response.status, 'Nie udało się pobrać pliku');
		}

		const headers = new Headers(response.headers);
		const encodedName = encodeURIComponent(filename);

		// Force the download filename
		headers.set(
			'Content-Disposition',
			`attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`
		);

		return new Response(response.body, {
			status: response.status,
			headers
		});
	} catch (e: any) {
		if (e.status) throw e;
		throw error(500, 'Wystąpił błąd podczas proxy pobierania');
	}
};
