import type { RequestEvent } from '@sveltejs/kit';
import type { OAuthProvider } from 'node-appwrite';

import { requireRuntimeEnv } from './runtime-env';

type RuntimeEvent = Pick<RequestEvent, 'platform' | 'url'>;

export function createOAuth2RedirectUrl(event: RuntimeEvent, provider: OAuthProvider): string {
	const endpoint = requireRuntimeEnv(event, 'PUBLIC_APPWRITE_ENDPOINT').replace(/\/+$/, '');
	const projectId = requireRuntimeEnv(event, 'PUBLIC_APPWRITE_PROJECT_ID');
	const origin = event.url.origin;
	const url = new URL(`${endpoint}/account/tokens/oauth2/${encodeURIComponent(provider)}`);

	url.searchParams.set('project', projectId);
	url.searchParams.set('success', `${origin}/auth/callback`);
	url.searchParams.set('failure', `${origin}/login?failure=true`);

	return url.toString();
}
