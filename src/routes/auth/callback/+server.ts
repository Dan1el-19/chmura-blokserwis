import { redirect, type RequestHandler } from '@sveltejs/kit';
import { createAdminClient, SESSION_COOKIE } from '$lib/server/appwrite';
import { logger } from '$lib/server/logger';

function isMissingSessionsWriteScope(error: unknown): boolean {
	return (
		typeof error === 'object' &&
		error !== null &&
		'message' in error &&
		String((error as { message: unknown }).message).includes('missing scopes') &&
		String((error as { message: unknown }).message).includes('sessions.write')
	);
}

export const GET: RequestHandler = async (event) => {
	const userId = event.url.searchParams.get('userId');
	const secret = event.url.searchParams.get('secret');

	if (!userId || !secret) {
		throw redirect(302, '/login?error=missing_params');
	}

	const { account } = createAdminClient(event);
	logger.info('[AUTH_CALLBACK] Attempting to create session...', {
		userId,
		secretLength: secret.length
	});
	let session;
	try {
		session = await account.createSession({ userId, secret });
	} catch (error) {
		if (isMissingSessionsWriteScope(error)) {
			logger.error(
				'[AUTH_CALLBACK] Appwrite API key is missing sessions.write scope. Create or update APPWRITE_API_KEY with the Sessions / sessions.write scope.'
			);
			throw redirect(302, '/login?error=appwrite_sessions_scope');
		}
		throw error;
	}
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
