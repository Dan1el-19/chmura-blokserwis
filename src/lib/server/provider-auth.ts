import type { RequestEvent } from '@sveltejs/kit';

export type ConfiguredWebAuthMode = 'appwrite' | 'clerk' | 'dual';
export type ActiveWebAuthProvider = 'appwrite' | 'clerk';

const DEFAULT_CLERK_SESSION_COOKIE = '__clerk_session';

function runtimeEnv(event: Pick<RequestEvent, 'platform'> | undefined): Record<string, unknown> {
	return (event?.platform?.env ?? {}) as Record<string, unknown>;
}

export function configuredWebAuthMode(
	event: Pick<RequestEvent, 'platform'> | undefined
): ConfiguredWebAuthMode {
	const value = runtimeEnv(event).UNISOURCE_WEB_AUTH_PROVIDER;
	return value === 'clerk' || value === 'dual' ? value : 'appwrite';
}

export function clerkSessionCookieName(
	event: Pick<RequestEvent, 'platform'> | undefined
): string {
	const configured = runtimeEnv(event).UNISOURCE_CLERK_SESSION_COOKIE;
	return typeof configured === 'string' && configured.trim().length > 0
		? configured.trim()
		: DEFAULT_CLERK_SESSION_COOKIE;
}

export function resolveClerkSessionToken(event: RequestEvent): string | null {
	const localToken = event.locals.clerkSessionToken?.trim();
	if (localToken) return localToken;

	const authorization = event.request.headers.get('authorization');
	if (authorization?.startsWith('Bearer ')) {
		const token = authorization.slice(7).trim();
		if (token) return token;
	}

	const cookieToken = event.cookies.get(clerkSessionCookieName(event));
	return cookieToken?.trim() || null;
}

export function isClerkWebSession(event: RequestEvent): boolean {
	return event.locals.authProvider === 'clerk' && Boolean(resolveClerkSessionToken(event));
}
