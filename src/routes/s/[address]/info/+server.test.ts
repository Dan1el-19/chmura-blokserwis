import { expect, it, vi } from 'vitest';
import { GET } from './+server.js';

it('uses the HttpOnly grant for same-origin public metadata and never caches it', async () => {
	const fetch = vi.fn(async (_url: URL, init: RequestInit) => {
		expect(new Headers(init.headers).get('X-Share-Grant')).toBe('opaque-grant');
		return Response.json({ requiresPassword: false, name: 'photo.png' });
	});
	const response = await GET({
		params: { address: 'public-token' },
		cookies: { get: () => 'opaque-grant', delete: vi.fn() },
		fetch
	} as unknown as Parameters<typeof GET>[0]);

	expect(response.status).toBe(200);
	expect(response.headers.get('Cache-Control')).toBe('no-store, private');
	expect(await response.json()).toMatchObject({ name: 'photo.png' });
});
