import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	configs: [] as Array<Record<string, unknown>>,
	createJWT: vi.fn(async () => ({ jwt: 'user-jwt' })),
	getAccount: vi.fn(async () => ({ $id: 'user-1' })),
	updateUser: vi.fn(async () => ({ item: {} })),
	fetch: vi.fn(),
	serviceId: 'default'
}));

vi.mock('@unisource/sdk/v2', () => ({
	UnisourceV2Client: class {
		readonly admin = { updateUser: mocks.updateUser };
		readonly public = {
			getShareLink: vi.fn(),
			unlockShareLink: vi.fn()
		};

		constructor(config: Record<string, unknown>) {
			mocks.configs.push(config);
		}
	}
}));

vi.mock('./appwrite', () => ({
	createSessionClient: () => ({
		account: {
			createJWT: mocks.createJWT,
			get: mocks.getAccount
		}
	})
}));

vi.mock('./runtime-env', () => ({
	requireRuntimeEnv: (_event: unknown, name: string) =>
		({
			UNISOURCE_URL: 'https://unisource.example',
			UNISOURCE_SERVICE_ID: mocks.serviceId,
			UNISOURCE_API_KEY: 'admin-key'
		})[name]
}));

import {
	createAdminUnisourceClient,
	createPublicUnisourceClient,
	createRequestAdminUnisourceClient,
	createUserUnisourceClient,
	requestAdminUnisourceV2
} from './unisource';

describe('UniSource V2 client factories', () => {
	beforeEach(() => {
		mocks.configs.length = 0;
		mocks.createJWT.mockClear();
		mocks.getAccount.mockClear();
		mocks.updateUser.mockClear();
		mocks.fetch.mockReset();
		vi.stubGlobal('fetch', mocks.fetch);
		mocks.serviceId = 'default';
	});

	it('creates a user client with JWT auth after bootstrapping service access', async () => {
		await createUserUnisourceClient({
			locals: { user: { $id: 'user-1' } }
		} as never);

		expect(mocks.configs).toHaveLength(2);
		expect(mocks.configs[0]).toMatchObject({
			baseUrl: 'https://unisource.example',
			serviceId: 'default',
			apiKey: 'admin-key',
			silentBeta: true
		});
		expect(mocks.configs[1]).toMatchObject({
			baseUrl: 'https://unisource.example',
			serviceId: 'default',
			silentBeta: true
		});
		expect(mocks.configs[1]).toHaveProperty('getToken');
		expect(mocks.configs[1]).not.toHaveProperty('apiKey');
		expect(await (mocks.configs[1].getToken as () => Promise<string>)()).toBe('user-jwt');
		expect(mocks.updateUser).toHaveBeenCalledWith('user-1', { role: 'user' });
	});

	it('bootstraps Appwrite admins as UniSource service admins', async () => {
		await createUserUnisourceClient({
			locals: { user: { $id: 'admin-1', labels: ['admin'] } }
		} as never);

		expect(mocks.updateUser).toHaveBeenCalledWith('admin-1', { role: 'admin' });
	});

	it('keeps user JWT reads possible when non-default bootstrap fails', async () => {
		mocks.serviceId = 'custom-service';
		mocks.updateUser.mockRejectedValueOnce(new Error('Forbidden'));

		await createUserUnisourceClient({
			locals: { user: { $id: 'user-1' } }
		} as never);

		expect(mocks.configs).toHaveLength(2);
		expect(mocks.configs[0]).toMatchObject({
			serviceId: 'custom-service',
			apiKey: 'admin-key'
		});
		expect(mocks.configs[1]).toMatchObject({
			serviceId: 'custom-service',
			silentBeta: true
		});
		expect(mocks.configs[1]).toHaveProperty('getToken');
		expect(mocks.updateUser).toHaveBeenCalledWith('user-1', { role: 'user' });
	});

	it('creates a request admin client with JWT auth', async () => {
		await createRequestAdminUnisourceClient({
			locals: { user: { $id: 'user-1' } }
		} as never);

		expect(mocks.configs).toHaveLength(1);
		expect(mocks.configs[0]).toMatchObject({
			baseUrl: 'https://unisource.example',
			serviceId: 'default',
			silentBeta: true
		});
		expect(mocks.configs[0]).toHaveProperty('getToken');
		expect(mocks.configs[0]).not.toHaveProperty('apiKey');
	});

	it('creates an admin client with API key auth', () => {
		createAdminUnisourceClient();

		expect(mocks.configs[0]).toMatchObject({
			baseUrl: 'https://unisource.example',
			serviceId: 'default',
			apiKey: 'admin-key',
			silentBeta: true
		});
		expect(mocks.configs[0]).not.toHaveProperty('getToken');
	});

	it('creates a public client without auth', () => {
		createPublicUnisourceClient();

		expect(mocks.configs[0]).toEqual({
			baseUrl: 'https://unisource.example',
			serviceId: 'default',
			silentBeta: true
		});
	});

	it('performs a raw V2 admin request with service API key auth', async () => {
		expect.assertions(5);

		mocks.fetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ item: { current_used_bytes: 123 } }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		const result = await requestAdminUnisourceV2<{ item: { current_used_bytes: number } }>(
			undefined,
			'GET',
			'/v2/admin/service/usage',
			{ query: { limit: 100, skip: undefined }, idempotencyKey: 'raw-request-1' }
		);

		expect(result.item.current_used_bytes).toBe(123);
		expect(mocks.fetch).toHaveBeenCalledTimes(1);
		const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://unisource.example/v2/admin/service/usage?limit=100');
		expect(init.headers).toMatchObject({
			Authorization: 'Bearer admin-key',
			'X-Service-ID': 'default',
			'Idempotency-Key': 'raw-request-1'
		});
		expect(init.body).toBeUndefined();
	});

	it('uses the request user JWT for raw V2 admin requests when a session event is available', async () => {
		expect.assertions(4);

		mocks.fetch.mockResolvedValueOnce(
			new Response(JSON.stringify({ items: [], page: { limit: 100, next_cursor: null } }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		);

		await requestAdminUnisourceV2(
			{ platform: undefined, locals: { user: { $id: 'user-1' } }, cookies: {} } as never,
			'GET',
			'/v2/releases',
			{ query: { limit: 100 } }
		);

		expect(mocks.createJWT).toHaveBeenCalledWith({ duration: 900 });
		const [url, init] = mocks.fetch.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://unisource.example/v2/releases?limit=100');
		expect(init.headers).toMatchObject({ Authorization: 'Bearer user-jwt' });
		expect(init.headers).not.toMatchObject({ Authorization: 'Bearer admin-key' });
	});
});
