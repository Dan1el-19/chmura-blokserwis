import { expect, it, vi } from 'vitest';
import { GET, POST } from './+server.js';

it('keeps temporary storage failures retryable for direct downloads', async () => {
	const fetch = vi.fn(async () => new Response('', { status: 503 }));
	const response = await GET({
		params: { address: 'public-token' },
		cookies: { get: () => undefined },
		request: new Request('https://chmura.blokserwis.pl/s/public-token/download'),
		fetch
	} as unknown as Parameters<typeof GET>[0]);

	expect(response.status).toBe(503);
	expect(await response.text()).toContain('Spróbuj ponownie później');
	expect(response.headers.get('Cache-Control')).toBe('no-store, private');
});

it('forwards the HttpOnly grant and stable request id to the API before redirecting', async () => {
	const fetch = vi.fn(async (_url: URL, init: RequestInit) => {
		expect(new Headers(init.headers).get('X-Share-Grant')).toBe('opaque-grant');
		expect(new Headers(init.headers).get('X-Request-ID')).toBe('download-attempt-1');
		return new Response(null, { status: 302, headers: { Location: 'https://storage.example/signed' } });
	});
	const request = new Request('https://chmura.blokserwis.pl/s/public-token/download', {
		method: 'POST',
		body: new URLSearchParams({ requestId: 'download-attempt-1' })
	});
	const response = await POST({
		params: { address: 'public-token' },
		cookies: { get: () => 'opaque-grant' },
		request,
		fetch
	} as unknown as Parameters<typeof POST>[0]);

	expect(response.status).toBe(302);
	expect(response.headers.get('Location')).toBe('https://storage.example/signed');
});

it('sends a protected direct-download URL to the password form', async () => {
	const fetch = vi.fn(async () => new Response('', { status: 401 }));
	const response = await GET({
		params: { address: 'protected-token' },
		cookies: { get: () => undefined },
		request: new Request('https://chmura.blokserwis.pl/s/protected-token/download'),
		fetch
	} as unknown as Parameters<typeof GET>[0]);

	expect(response.status).toBe(303);
	expect(response.headers.get('Location')).toBe('/s/protected-token');
});

it('shows the exhausted download limit on the direct-download URL', async () => {
	const fetch = vi.fn(async () => new Response('', { status: 410 }));
	const response = await GET({
		params: { address: 'limited-token' },
		cookies: { get: () => undefined },
		request: new Request('https://chmura.blokserwis.pl/s/limited-token/download'),
		fetch
	} as unknown as Parameters<typeof GET>[0]);

	expect(response.status).toBe(410);
	expect(await response.text()).toContain('Limit pobrań dla tego linku został wyczerpany.');
});

it('asks the user to refresh when an idempotent download request has expired', async () => {
	const fetch = vi.fn(async () => new Response('', { status: 409 }));
	const response = await GET({
		params: { address: 'public-token' },
		cookies: { get: () => undefined },
		request: new Request('https://chmura.blokserwis.pl/s/public-token/download'),
		fetch
	} as unknown as Parameters<typeof GET>[0]);

	expect(response.status).toBe(409);
	expect(await response.text()).toContain('Odśwież stronę i rozpocznij pobieranie ponownie.');
});


it('preserves the GET form request id with the grant for a retryable download', async () => {
	const fetch = vi.fn(async (_url: URL, init: RequestInit) => {
		expect(new Headers(init.headers).get('X-Request-ID')).toBe('download-attempt-1');
		expect(new Headers(init.headers).get('X-Share-Grant')).toBe('opaque-grant');
		return new Response(null, { status: 302, headers: { Location: 'https://storage.example/signed' } });
	});
	const response = await GET({
		params: { address: 'public-token' },
		cookies: { get: () => 'opaque-grant' },
		request: new Request('https://chmura.blokserwis.pl/s/public-token/download?requestId=download-attempt-1'),
		fetch
	} as unknown as Parameters<typeof GET>[0]);

	expect(response.status).toBe(302);
});
