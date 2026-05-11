import { describe, expect, it } from 'vitest';

import { normalizeAppwriteEnv } from './appwrite-env';

describe('normalizeAppwriteEnv', () => {
	it('uses releases Appwrite values as the standard Appwrite configuration', () => {
		expect.assertions(3);

		const env = normalizeAppwriteEnv({
			PUBLIC_APPWRITE_ENDPOINT: 'https://main.example/v1',
			PUBLIC_APPWRITE_PROJECT_ID: 'main-project',
			APPWRITE_API_KEY: 'main-key',
			RELEASES_APPWRITE_ENDPOINT: 'https://releases.example/v1',
			RELEASES_APPWRITE_PROJECT_ID: 'releases-project',
			RELEASES_APPWRITE_API_KEY: 'releases-key'
		});

		expect(env.PUBLIC_APPWRITE_ENDPOINT).toBe('https://releases.example/v1');
		expect(env.PUBLIC_APPWRITE_PROJECT_ID).toBe('releases-project');
		expect(env.APPWRITE_API_KEY).toBe('releases-key');
	});

	it('keeps the standard Appwrite values when releases values are not configured', () => {
		expect.assertions(3);

		const env = normalizeAppwriteEnv({
			PUBLIC_APPWRITE_ENDPOINT: 'https://main.example/v1',
			PUBLIC_APPWRITE_PROJECT_ID: 'main-project',
			APPWRITE_API_KEY: 'main-key'
		});

		expect(env.PUBLIC_APPWRITE_ENDPOINT).toBe('https://main.example/v1');
		expect(env.PUBLIC_APPWRITE_PROJECT_ID).toBe('main-project');
		expect(env.APPWRITE_API_KEY).toBe('main-key');
	});
});
