import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
	configs: [] as Array<Record<string, unknown>>,
	createJWT: vi.fn(async () => ({ jwt: 'user-jwt' })),
	getAccount: vi.fn(async () => ({ $id: 'user-1' }))
}));

vi.mock('@unisource/sdk/v2', () => ({
	UnisourceV2Client: class {
		readonly admin = { updateUser: vi.fn(async () => ({ item: {} })) };
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
			UNISOURCE_SERVICE_ID: 'usrc',
			UNISOURCE_API_KEY: 'admin-key'
		})[name]
}));

import {
	createAdminUnisourceClient,
	createPublicUnisourceClient,
	createUserUnisourceClient
} from './unisource';

describe('UniSource V2 client factories', () => {
	beforeEach(() => {
		mocks.configs.length = 0;
		mocks.createJWT.mockClear();
		mocks.getAccount.mockClear();
	});

	it('creates a user client with JWT auth', async () => {
		await createUserUnisourceClient({
			locals: { user: { $id: 'user-1' } }
		} as never);

		expect(mocks.configs).toHaveLength(1);
		expect(mocks.configs[0]).toMatchObject({
			baseUrl: 'https://unisource.example',
			serviceId: 'usrc',
			silentBeta: true
		});
		expect(mocks.configs[0]).toHaveProperty('getToken');
		expect(mocks.configs[0]).not.toHaveProperty('apiKey');
		expect(await (mocks.configs[0].getToken as () => Promise<string>)()).toBe('user-jwt');
	});

	it('creates an admin client with API key auth', () => {
		createAdminUnisourceClient();

		expect(mocks.configs[0]).toMatchObject({
			baseUrl: 'https://unisource.example',
			serviceId: 'usrc',
			apiKey: 'admin-key',
			silentBeta: true
		});
		expect(mocks.configs[0]).not.toHaveProperty('getToken');
	});

	it('creates a public client without auth', () => {
		createPublicUnisourceClient();

		expect(mocks.configs[0]).toEqual({
			baseUrl: 'https://unisource.example',
			serviceId: 'usrc',
			silentBeta: true
		});
	});
});
