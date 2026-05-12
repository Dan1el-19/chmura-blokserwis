import { redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent } from '@sveltejs/kit';
import { createAdminClient, SESSION_COOKIE } from '$lib/server/appwrite';
import { OAuthProvider } from 'node-appwrite';
import { logger } from '$lib/server/logger';
import { createOAuth2RedirectUrl } from '$lib/server/oauth';

const isSecureContext = (event: RequestEvent): boolean => {
	return event.url.protocol === 'https:';
};

export const actions: Actions = {
	login: async (event) => {
		const data = await event.request.formData();
		const email = data.get('email') as string;
		const password = data.get('password') as string;

		if (!email || !password) {
			return { error: 'Email and password are required' };
		}

		const { account } = createAdminClient(event);

		try {
			logger.info('[LOGIN] Attempting email/password session...', { email });
			const session = await account.createEmailPasswordSession({ email, password });
			logger.info('[LOGIN] Session created successfully');

			event.cookies.set(SESSION_COOKIE, session.secret, {
				path: '/',
				httpOnly: true,
				secure: isSecureContext(event),
				sameSite: 'lax',
				expires: new Date(session.expire)
			});
		} catch {
			return { email, error: 'Nieprawidłowy email lub hasło' };
		}

		throw redirect(303, '/');
	},

	oauth: async (event) => {
		throw redirect(302, createOAuth2RedirectUrl(event, OAuthProvider.Github));
	},

	google: async (event) => {
		throw redirect(302, createOAuth2RedirectUrl(event, OAuthProvider.Google));
	}
};
