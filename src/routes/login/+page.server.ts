import { redirect } from '@sveltejs/kit';
import type { Actions, RequestEvent } from '@sveltejs/kit';
import { createAdminClient, SESSION_COOKIE } from '$lib/server/appwrite';
import { OAuthProvider } from 'node-appwrite';
import { env } from '$env/dynamic/private';

const getOrigin = (event: RequestEvent): string => {
	return env.ORIGIN || event.url.origin;
};

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

		const { account } = createAdminClient();

		try {
			console.log('[LOGIN] Attempting email/password session...', { email });
			const session = await account.createEmailPasswordSession({ email, password });
			console.log('[LOGIN] Session created successfully');

			event.cookies.set(SESSION_COOKIE, session.secret, {
				path: '/',
				httpOnly: true,
				secure: isSecureContext(event),
				sameSite: 'lax',
				expires: new Date(session.expire)
			});
		} catch (e: any) {
			return { email, error: e.message };
		}

		throw redirect(303, '/');
	},

	oauth: async (event) => {
		const { account } = createAdminClient();
		const origin = getOrigin(event);
		console.log('[OAUTH] Using origin:', origin);
		const redirectUrl = await account.createOAuth2Token({
			provider: OAuthProvider.Github,
			success: `${origin}/auth/callback`,
			failure: `${origin}/login?failure=true`
		});

		throw redirect(302, redirectUrl);
	},

	google: async (event) => {
		const { account } = createAdminClient();
		const origin = getOrigin(event);
		console.log('[OAUTH] Using origin:', origin);
		const redirectUrl = await account.createOAuth2Token({
			provider: OAuthProvider.Google,
			success: `${origin}/auth/callback`,
			failure: `${origin}/login?failure=true`
		});

		throw redirect(302, redirectUrl);
	}
};
