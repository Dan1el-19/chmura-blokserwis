import { redirect, type RequestHandler } from '@sveltejs/kit';
import { createAdminClient, SESSION_COOKIE } from '$lib/server/appwrite';
import { logger } from '$lib/server/logger';

export const GET: RequestHandler = async (event) => {
	const userId = event.url.searchParams.get('userId');
	const secret = event.url.searchParams.get('secret');

	if (!userId || !secret) {
		throw redirect(302, '/login?error=missing_params');
	}

	const { account } = createAdminClient();
	logger.info('[AUTH_CALLBACK] Attempting to create session...', {
		userId,
		secretLength: secret.length
	});
	const session = await account.createSession({ userId, secret });
	logger.info('[AUTH_CALLBACK] Session created successfully', { expire: session.expire });

	const isSecure = event.url.protocol === 'https:';
	event.cookies.set(SESSION_COOKIE, session.secret, {
		path: '/',
		httpOnly: true,
		secure: isSecure,
		sameSite: 'lax',
		expires: new Date(session.expire)
	});

	throw redirect(302, '/');
};
