import { describe, expect, it, vi } from 'vitest';
import { OAuthProvider } from 'node-appwrite';

const runtimeEnv = vi.hoisted(
	(): Record<string, string | undefined> => ({
		PUBLIC_APPWRITE_ENDPOINT: 'https://fra.cloud.appwrite.io/v1',
		PUBLIC_APPWRITE_PROJECT_ID: 'releases-project'
	})
);

vi.mock('./runtime-env', () => ({
	getRuntimeEnv: () => runtimeEnv,
	requireRuntimeEnv: (_event: unknown, name: string) => {
		const value = runtimeEnv[name];
		if (!value) throw new Error(`Missing runtime environment binding: ${name}`);
		return value;
	}
}));

import { createOAuth2RedirectUrl } from './oauth';

describe('createOAuth2RedirectUrl', () => {
	it('builds an Appwrite OAuth URL with the project query parameter', () => {
		expect.assertions(5);

		const url = new URL(
			createOAuth2RedirectUrl(
				{
					url: new URL('http://localhost:5173/login'),
					platform: undefined
				},
				OAuthProvider.Github
			)
		);

		expect(url.origin).toBe('https://fra.cloud.appwrite.io');
		expect(url.pathname).toBe('/v1/account/tokens/oauth2/github');
		expect(url.searchParams.get('project')).toBe('releases-project');
		expect(url.searchParams.get('success')).toBe('http://localhost:5173/auth/callback');
		expect(url.searchParams.get('failure')).toBe('http://localhost:5173/login?failure=true');
	});

	it('uses the current request origin instead of the ORIGIN environment override', () => {
		expect.assertions(2);

		runtimeEnv.ORIGIN = 'https://chmura.blokserwis.pl';

		const url = new URL(
			createOAuth2RedirectUrl(
				{
					url: new URL('https://new-brand.example/login'),
					platform: undefined
				},
				OAuthProvider.Google
			)
		);

		expect(url.searchParams.get('success')).toBe('https://new-brand.example/auth/callback');
		expect(url.searchParams.get('failure')).toBe('https://new-brand.example/login?failure=true');
	});
});
