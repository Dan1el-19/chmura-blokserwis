import { describe, expect, it } from 'vitest';
import { resolveClerkAuthState } from './clerk-auth-state.js';

describe('resolveClerkAuthState', () => {
	it('does not expose a pending Clerk session as signed in', async () => {
		let tokenRequests = 0;
		const result = await resolveClerkAuthState(
			{ id: 'user_1' },
			{
				id: 'session_1',
				status: 'pending',
				currentTask: { key: 'setup-mfa' },
				getToken: async () => {
					tokenRequests++;
					return 'token';
				}
			},
			() => true
		);

		expect(result).toEqual({
			status: 'pending',
			user: null,
			error: 'Dokończ konfigurację weryfikacji dwuetapowej.'
		});
		expect(tokenRequests).toBe(0);
	});

	it('marks an active session signed in only after Clerk returns a token', async () => {
		const user = { id: 'user_1' };
		const result = await resolveClerkAuthState(
			user,
			{ id: 'session_1', status: 'active', getToken: async () => 'token' },
			() => true
		);

		expect(result).toEqual({ status: 'signed-in', user, error: null });
	});

	it('does not sign in when an active Clerk session returns no token', async () => {
		const result = await resolveClerkAuthState(
			{ id: 'user_1' },
			{ id: 'session_1', status: 'active', getToken: async () => null },
			() => true
		);

		expect(result).toMatchObject({ status: 'error' });
	});

	it('discards a token result if Clerk changed sessions while it was loading', async () => {
		let currentSessionId = 'session_1';
		let releaseToken: ((token: string) => void) | undefined;
		const resultPromise = resolveClerkAuthState(
			{ id: 'user_1' },
			{
				id: 'session_1',
				status: 'active',
				getToken: () => new Promise<string>((resolve) => (releaseToken = resolve))
			},
			() => currentSessionId === 'session_1'
		);

		currentSessionId = 'session_2';
		releaseToken?.('token');

		await expect(resultPromise).resolves.toBeNull();
	});
});
