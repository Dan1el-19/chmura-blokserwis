import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BLOCKED_HOSTS = [
	/^localhost$/i,
	/^127\./,
	/^10\./,
	/^192\.168\./,
	/^172\.(1[6-9]|2\d|3[01])\./,
	/^169\.254\./,
	/^0\.0\.0\.0$/,
	/^\[?::1\]?$/,
	/^fc[0-9a-f]{2}:/i,
	/^fd[0-9a-f]{2}:/i,
	/^metadata\.google\.internal$/i
];

export const GET: RequestHandler = async ({ url, locals }) => {
	if (!locals.user) throw error(401, 'Unauthorized');

	const targetUrl = url.searchParams.get('url');
	const filename = url.searchParams.get('name');

	if (!targetUrl || !filename) throw error(400, 'Brak wymaganego parametru url lub name');

	let parsedUrl: URL;
	try {
		parsedUrl = new URL(targetUrl);
	} catch {
		throw error(400, 'Nieprawidłowy URL');
	}

	if (parsedUrl.protocol !== 'https:') throw error(400, 'Niedozwolony protokół URL');

	const hostname = parsedUrl.hostname;
	if (BLOCKED_HOSTS.some((re) => re.test(hostname))) throw error(400, 'Niedozwolony host URL');

	let response: Response;
	try {
		response = await fetch(targetUrl, { redirect: 'error' });
	} catch {
		throw error(502, 'Nie udało się pobrać pliku');
	}

	if (!response.ok) throw error(response.status, 'Nie udało się pobrać pliku');

	const encodedName = encodeURIComponent(filename);
	const safeHeaders = new Headers({
		'Content-Disposition': `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
		'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
		...(response.headers.get('Content-Length')
			? { 'Content-Length': response.headers.get('Content-Length')! }
			: {})
	});

	return new Response(response.body, { status: 200, headers: safeHeaders });
};
