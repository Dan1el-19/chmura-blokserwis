import { expect, it, vi } from 'vitest';
import { GET } from './+server.js';

it('forwards only folder cursor and grant to the folder API', async () => {
	const fetch=vi.fn(async (url:URL,init:RequestInit) => {
		expect(url.searchParams.get('folder')).toBe('folder-1');
		expect(url.searchParams.get('pageToken')).toBe('cursor');
		expect(url.searchParams.has('unexpected')).toBe(false);
		expect(new Headers(init.headers).get('X-Share-Grant')).toBe('grant');
		return Response.json({entries:[]});
	});
	const response=await GET({params:{address:'share-1'},url:new URL('https://example.test/s/share-1/folder?folder=folder-1&pageToken=cursor&unexpected=1'),cookies:{get:()=> 'grant'},fetch} as unknown as Parameters<typeof GET>[0]);
	expect(response.status).toBe(200);
	expect(response.headers.get('cache-control')).toBe('no-store, private');
});
