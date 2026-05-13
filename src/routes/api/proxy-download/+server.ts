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

/**
 * S6: hard caps on the proxy. Files larger than `MAX_PROXY_BYTES` are
 * rejected before we start streaming, and the upstream fetch is aborted
 * after `PROXY_TIMEOUT_MS` to avoid wedging a worker on a slow origin.
 *
 * 5 GiB cap is enough for any single chmura-blokserwis file (largest user
 * upload allowed by services.maxFileSizeBytes). 60 s timeout covers slow
 * mobile networks while still bounding worst-case CPU time.
 */
const MAX_PROXY_BYTES = 5 * 1024 * 1024 * 1024;
const PROXY_TIMEOUT_MS = 60_000;

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

	const abortController = new AbortController();
	const timeoutId = setTimeout(() => abortController.abort(), PROXY_TIMEOUT_MS);

	let response: Response;
	try {
		response = await fetch(targetUrl, {
			redirect: 'error',
			signal: abortController.signal
		});
	} catch (err) {
		clearTimeout(timeoutId);
		if (err instanceof Error && err.name === 'AbortError') {
			throw error(504, 'Upłynął limit czasu pobrania pliku');
		}
		throw error(502, 'Nie udało się pobrać pliku');
	}

	if (!response.ok) {
		clearTimeout(timeoutId);
		throw error(response.status, 'Nie udało się pobrać pliku');
	}

	// S6: reject before streaming when the upstream announces an oversized
	// Content-Length. The cap is informational — we still rely on the upstream
	// to honour it — but it's a cheap first-line defence.
	const upstreamLength = response.headers.get('Content-Length');
	if (upstreamLength) {
		const lengthNum = Number(upstreamLength);
		if (Number.isFinite(lengthNum) && lengthNum > MAX_PROXY_BYTES) {
			clearTimeout(timeoutId);
			response.body?.cancel().catch(() => undefined);
			throw error(413, 'Plik przekracza limit proxy (5 GiB)');
		}
	}

	const encodedName = encodeURIComponent(filename);
	const safeHeaders = new Headers({
		'Content-Disposition': `attachment; filename="${encodedName}"; filename*=UTF-8''${encodedName}`,
		'Content-Type': response.headers.get('Content-Type') || 'application/octet-stream',
		...(upstreamLength ? { 'Content-Length': upstreamLength } : {})
	});

	// Best-effort: clear timeout once headers are written so we don't kill an
	// in-progress download. The AbortSignal is no longer needed once the
	// response is being streamed back to the client.
	clearTimeout(timeoutId);

	return new Response(response.body, { status: 200, headers: safeHeaders });
};
