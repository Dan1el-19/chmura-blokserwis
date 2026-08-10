import { describe, expect, it } from 'vitest';

import {
	configuredWebAuthMode,
	resolveClerkSessionToken
} from './provider-auth';

function event(overrides: Record<string, unknown> = {}) {
	return {
		platform: { env: overrides.env ?? {} },
		locals: overrides.locals ?? {},
		request: new Request('https://chmura.test/', {
			headers: overrides.headers as HeadersInit | undefined
		}),
		cookies: {
			get: (name: string) => (overrides.cookies as Record<string, string> | undefined)?.[name]
		}
	} as never;
}

describe('provider-neutral web auth', () => {
	it('keeps Appwrite as the default and supports explicit dual mode', () => {
		expect(configuredWebAuthMode(event())).toBe('appwrite');
		expect(configuredWebAuthMode(event({ env: { UNISOURCE_WEB_AUTH_PROVIDER: 'dual' } }))).toBe('dual');
	});

	it('resolves Clerk token from locals before the request header', () => {
		const result = resolveClerkSessionToken(event({
			locals: { clerkSessionToken: 'local-token' },
			headers: { authorization: 'Bearer header-token' }
		}));
		expect(result).toBe('local-token');
	});

	it('supports an explicitly configured HttpOnly cookie name', () => {
		const result = resolveClerkSessionToken(event({
			env: { UNISOURCE_CLERK_SESSION_COOKIE: 'secure_clerk_session' },
			cookies: { secure_clerk_session: 'cookie-token' }
		}));
		expect(result).toBe('cookie-token');
	});
});
