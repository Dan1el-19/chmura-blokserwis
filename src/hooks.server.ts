import { createSessionClient, SESSION_COOKIE } from '$lib/server/appwrite';
import { redirect, type Handle } from '@sveltejs/kit';
import { getUserRole } from '$lib/server/roles';
import {
	checkRateLimit,
	rateLimitHeaders,
	ratelimit,
	strictRatelimit
} from '$lib/server/rate-limit';
import { env } from '$env/dynamic/private';

const PUBLIC_ROUTES = ['/login', '/register', '/auth/callback'];

const RATE_LIMIT_ENABLED = !!env.UPSTASH_REDIS_REST_URL;

export const handle: Handle = async ({ event, resolve }) => {
	try {
		if (RATE_LIMIT_ENABLED && event.url.pathname.startsWith('/api/')) {
			let identifier: string;
			try {
				identifier = event.getClientAddress();
			} catch {
				identifier = 'unknown';
			}

			const isStrictEndpoint =
				event.url.pathname.includes('/api/uppy/') ||
				event.url.pathname.includes('/api/files') ||
				event.url.pathname.includes('/api/folders');

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

		const { account } = createSessionClient(event);
		const sessionCookie = event.cookies.get(SESSION_COOKIE);

		try {
			if (sessionCookie) {
				console.log(
					'[HOOKS]',
					event.url.pathname,
					'Session cookie present:',
					sessionCookie.substring(0, 10) + '...'
				);
			} else {
				console.log('[HOOKS]', event.url.pathname, 'No session cookie');
			}
			event.locals.user = await account.get();
			console.log('[HOOKS]', event.url.pathname, 'User authenticated:', event.locals.user.$id);
		} catch (err) {
			if (sessionCookie) {
				console.error('[HOOKS]', event.url.pathname, 'Failed to get user from session:', err);
			}
			event.locals.user = undefined;
		}

		const isPublicRoute = PUBLIC_ROUTES.some((route) => {
			return event.url.pathname === route;
		});

		if (!event.locals.user && !isPublicRoute) {
			if (event.url.pathname.startsWith('/api/')) {
				return new Response(JSON.stringify({ error: 'Unauthorized' }), {
					status: 401,
					headers: { 'Content-Type': 'application/json' }
				});
			}
			throw redirect(303, '/login');
		}

		if (event.locals.user && event.url.pathname === '/login') {
			throw redirect(303, '/');
		}

		const isAdminRoute =
			event.url.pathname.startsWith('/admin') ||
			event.url.pathname.startsWith('/api/admin') ||
			event.url.pathname.startsWith('/preview/');

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

		return resolve(event);
	} catch (e: any) {
		if (e?.status === 303) throw e;
		console.error('Hooks Error:', e);
		return new Response(`Internal Error: ${e.message} \nStack: ${e.stack}`, { status: 500 });
	}
};
