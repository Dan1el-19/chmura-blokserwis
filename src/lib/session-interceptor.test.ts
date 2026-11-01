import { Code, ConnectError, type UnaryRequest, type UnaryResponse } from '@connectrpc/connect';
import { describe, expect, it } from 'vitest';
import { createSessionInterceptor } from './session-interceptor.js';

function createRequest(): UnaryRequest {
	return {
		header: new Headers(),
		signal: new AbortController().signal
	} as UnaryRequest;
}

const response = {} as UnaryResponse;

describe('createSessionInterceptor', () => {
	it('does not call the API without an active Clerk token', async () => {
		let requests = 0;
		const invoke = createSessionInterceptor(async () => null)(async () => {
			requests++;
			return response;
		}) as (request: UnaryRequest) => Promise<UnaryResponse>;

		await expect(invoke(createRequest())).rejects.toMatchObject({
			code: Code.Unauthenticated,
			rawMessage: 'Brak aktywnej sesji Clerk.'
		});
		expect(requests).toBe(0);
	});

	it('fetches an uncached token and retries once after an unauthenticated response', async () => {
		const tokenOptions: Array<{ skipCache?: boolean } | undefined> = [];
		const tokens = ['cached-token', 'fresh-token'];
		let requests = 0;
		const invoke = createSessionInterceptor(async (options) => {
			tokenOptions.push(options);
			return tokens.shift() ?? null;
		})(async (request) => {
			requests++;
			if (requests === 1) throw new ConnectError('expired', Code.Unauthenticated);
			return { ...response, authorization: request.header.get('authorization') } as UnaryResponse;
		}) as (request: UnaryRequest) => Promise<UnaryResponse>;
		const request = createRequest();

		const result = (await invoke(request)) as UnaryResponse & { authorization: string };

		expect(result.authorization).toBe('Bearer fresh-token');
		expect(requests).toBe(2);
		expect(tokenOptions).toEqual([undefined, { skipCache: true }]);
	});

	it('does not repeat a request when refresh returns the same rejected token', async () => {
		let requests = 0;
		const invoke = createSessionInterceptor(async () => 'same-token')(async () => {
			requests++;
			throw new ConnectError('rejected', Code.Unauthenticated);
		}) as (request: UnaryRequest) => Promise<UnaryResponse>;

		await expect(invoke(createRequest())).rejects.toMatchObject({ rawMessage: 'rejected' });
		expect(requests).toBe(1);
	});
});
