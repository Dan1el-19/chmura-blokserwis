import { createSessionClient, SESSION_COOKIE } from '$lib/server/appwrite';
import { redirect, type Handle } from '@sveltejs/kit';
import { getUserRole } from '$lib/server/roles';
import {
	checkRateLimit,
	rateLimitHeaders,
	ratelimit,
	strictRatelimit,
	RATE_LIMIT_ENABLED
} from '$lib/server/rate-limit';
import { logger } from '$lib/server/logger';
import {
	configuredWebAuthMode,
	resolveClerkSessionToken,
	isClerkWebSession
} from '$lib/server/provider-auth';

const PUBLIC_ROUTES = ['/login', '/register', '/auth/callback'];
const QUOTATION_PREVIEW_PATH = /^\/api\/quotations\/[^/]+\/preview$/;

function isUnauthorizedSessionError(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'code' in error &&
		(error as { code?: unknown }).code === 401
	);
}

export const handle: Handle = async ({ event, resolve }) => {
	try {
		if (RATE_LIMIT_ENABLED && event.url.pathname.startsWith('/api/')) {
			// Multipart upload hot path: sign-part and list-parts are called
			// once per chunk (potentially hundreds per file). The UniSource
			// backend already rate-limits these per user (1000/60s), so a
			// per-IP cap here adds no defence and breaks legitimate uploads
			// of large files.
			const isMultipartHotPath =
				event.url.pathname === '/api/upload/r2/multipart/sign-part' ||
				event.url.pathname === '/api/upload/r2/multipart/list-parts' ||
				event.url.pathname === '/api/releases/multipart/sign-part' ||
				event.url.pathname === '/api/releases/multipart/list-parts';

			if (!isMultipartHotPath) {
				let identifier: string;
				try {
					identifier = event.getClientAddress();
				} catch {
					identifier = 'unknown';
				}

				const isStrictEndpoint =
					event.url.pathname.includes('/api/files') || event.url.pathname.includes('/api/folders');

				const limiter = isStrictEndpoint ? strictRatelimit : ratelimit;
				const result = await checkRateLimit(identifier, limiter);

				if (!result.success) {
					return new Response(JSON.stringify({ error: 'Too many requests' }), {
						status: 429,
						headers: {
							'Content-Type': 'application/json',
							...rateLimitHeaders(result)
						}
					});
				}
			}
		}

		const sessionCookie = event.cookies.get(SESSION_COOKIE);
		const configuredAuthMode = configuredWebAuthMode(event);
		const sessionClient = configuredAuthMode === 'clerk' ? undefined : createSessionClient(event);
		event.locals.authProvider = undefined;
		event.locals.clerkSessionToken = undefined;

		if (configuredAuthMode === 'clerk' || configuredAuthMode === 'dual') {
			event.locals.clerkSessionToken = resolveClerkSessionToken(event) ?? undefined;
		}
		if (configuredAuthMode === 'clerk') {
			event.locals.authProvider = 'clerk';
		}

		try {
			if (sessionCookie) {
				logger.debug(
					'[HOOKS]',
					event.url.pathname,
					'Session cookie present:',
					sessionCookie.substring(0, 10) + '...'
				);
			} else {
				logger.debug('[HOOKS]', event.url.pathname, 'No session cookie');
			}
			if (configuredAuthMode === 'clerk') {
				event.locals.user = undefined;
			} else {
				event.locals.user = await sessionClient!.account.get();
				event.locals.authProvider = 'appwrite';
				logger.info('[HOOKS]', event.url.pathname, 'User authenticated:', event.locals.user.$id);
			}
		} catch (err) {
			if (sessionCookie) {
				logger.error('[HOOKS]', event.url.pathname, 'Failed to get user from session:', err);
				if (isUnauthorizedSessionError(err)) {
					event.cookies.delete(SESSION_COOKIE, { path: '/' });
				}
			}
			event.locals.user = undefined;
		}

		if (!event.locals.user && isClerkWebSession(event)) {
			event.locals.authProvider = 'clerk';
		}

		const isPublicRoute = PUBLIC_ROUTES.some((route) => {
			return event.url.pathname === route || event.url.pathname.startsWith('/file/');
		});

		const hasAuthenticatedSession = Boolean(event.locals.user) || isClerkWebSession(event);
		if (!hasAuthenticatedSession && !isPublicRoute) {
			if (event.url.pathname.startsWith('/api/')) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			throw redirect(303, '/login');
		}

		if (hasAuthenticatedSession && event.url.pathname === '/login') {
			throw redirect(303, '/');
		}

		const isAdminRoute =
			event.url.pathname.startsWith('/admin') ||
			event.url.pathname.startsWith('/api/admin') ||
			event.url.pathname.startsWith('/preview/') ||
			event.url.pathname.startsWith('/releases') ||
			event.url.pathname.startsWith('/api/releases');

		if (isAdminRoute && event.locals.authProvider === 'clerk') {
			if (event.url.pathname.startsWith('/api/')) {
				return new Response(JSON.stringify({ error: 'Forbidden' }), {
					status: 403,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			throw redirect(303, '/');
		}

		if (isAdminRoute && event.locals.user) {
			const role = getUserRole(event.locals.user);
			if (role !== 'admin') {
				if (event.url.pathname.startsWith('/api/')) {
					return new Response(JSON.stringify({ error: 'Forbidden' }), {
						status: 403,
						headers: { 'Content-Type': 'application/json' }
					});
				}
				throw redirect(303, '/');
			}
		}

		const response = await resolve(event);
		response.headers.set('Cache-Control', 'private');
		response.headers.set('X-Content-Type-Options', 'nosniff');
		response.headers.set(
			'X-Frame-Options',
			QUOTATION_PREVIEW_PATH.test(event.url.pathname) ? 'SAMEORIGIN' : 'DENY'
		);
		response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
		response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
		// CSP tymczasowo wyłączone
		// response.headers.set(
		// 'Content-Security-Policy',
		// [
		// "default-src 'self'",
		// "img-src 'self' https: data: blob:",
		// "media-src 'self' https: blob:",
		// "script-src 'self'",
		// "style-src 'self' 'unsafe-inline'",
		// "connect-src 'self' https://*.blokserwis.pl https://*.cloudflare.com",
		// "frame-src 'self'",
		// "object-src 'none'",
		// "base-uri 'self'",
		// "form-action 'self'"
		// ].join('; ')
		// );
		if (event.url.protocol === 'https:') {
			response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
		}
		return response;
	} catch (e: any) {
		if (e?.status === 303) throw e;
		logger.error('Hooks Error:', e);
		return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
