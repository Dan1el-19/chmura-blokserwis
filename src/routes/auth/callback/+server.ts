import { redirect, type RequestHandler } from '@sveltejs/kit';
import { createAdminClient, SESSION_COOKIE } from '$lib/server/appwrite';

export const GET: RequestHandler = async (event) => {
	const userId = event.url.searchParams.get('userId');
	const secret = event.url.searchParams.get('secret');

	if (!userId || !secret) {
		throw redirect(302, '/login?error=missing_params');
	}

	const { account } = createAdminClient();
	console.log('[AUTH_CALLBACK] Attempting to create session...', {
		userId,
		secretLength: secret.length
	});
	const session = await account.createSession({ userId, secret });
	console.log('[AUTH_CALLBACK] Session created successfully', { expire: session.expire });

	event.cookies.set(SESSION_COOKIE, session.secret, {
		path: '/',
		httpOnly: true,
		secure: true,
		sameSite: 'lax',
		expires: new Date(session.expire)
	});

	throw redirect(302, '/');
};
