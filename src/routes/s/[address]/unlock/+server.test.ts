import { expect, it, vi } from 'vitest';
import { POST } from './+server.js';

it('keeps the share grant in a secure HttpOnly cookie and returns no token to the page', async () => {
	const fetch = vi.fn(async (_url: URL, init: RequestInit) => {
		expect(JSON.parse(String(init.body))).toEqual({ password: 'secret in body', requestId: 'unlock-request-1' });
		return Response.json({ ok: true, grant: 'opaque-grant-value', expiresAt: new Date(Date.now() + 60_000).toISOString() });
	});
	const set = vi.fn();
	const response = await POST({
		params: { address: 'public-token' },
		request: new Request('https://chmura.blokserwis.pl/s/public-token/unlock', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ password: 'secret in body', requestId: 'unlock-request-1' })
		}),
		fetch,
		cookies: { set }
	} as unknown as Parameters<typeof POST>[0]);

	expect(response.status).toBe(200);
	const result = await response.json();
	expect(result).toMatchObject({ ok: true });
	expect(JSON.stringify(result)).not.toContain('opaque-grant-value');
	expect(set).toHaveBeenCalledWith('share_grant_public-token', 'opaque-grant-value', expect.objectContaining({
		path: '/s/public-token',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		maxAge: expect.any(Number)
	}));
});
