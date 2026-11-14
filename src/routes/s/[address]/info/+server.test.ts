import { expect, it, vi } from 'vitest';
import { GET } from './+server.js';

it('uses the HttpOnly grant for same-origin public metadata and never caches it', async () => {
	const fetch = vi.fn(async (_url: URL, init: RequestInit) => {
		expect(new Headers(init.headers).get('X-Share-Grant')).toBe('opaque-grant');
		return Response.json({ requiresPassword: false, name: 'photo.png' });
	});
	const response = await GET({
		params: { address: 'public-token' },
		url: new URL('https://example.test/s/public-token/info'),
		cookies: { get: () => 'opaque-grant', delete: vi.fn() },
		fetch
	} as unknown as Parameters<typeof GET>[0]);

	expect(response.status).toBe(200);
	expect(response.headers.get('Cache-Control')).toBe('no-store, private');
	expect(await response.json()).toMatchObject({ name: 'photo.png' });
});

it('forwards a descendant file id and keeps the grant after a missing child', async () => {
	const deleted=vi.fn();
	const fetch=vi.fn(async (url:URL,init:RequestInit) => {
		expect(url.searchParams.get('file')).toBe('file-1');
		expect(new Headers(init.headers).get('X-Share-Grant')).toBe('opaque-grant');
		return Response.json({code:'NOT_AVAILABLE'},{status:404});
	});
	const response=await GET({params:{address:'public-token'},url:new URL('https://example.test/s/public-token/info?file=file-1'),cookies:{get:()=> 'opaque-grant',delete:deleted},fetch} as unknown as Parameters<typeof GET>[0]);
	expect(response.status).toBe(404);
	expect(deleted).not.toHaveBeenCalled();
});
