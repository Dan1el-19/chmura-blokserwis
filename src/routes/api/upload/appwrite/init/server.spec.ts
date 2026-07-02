import { beforeEach, describe, expect, it, vi } from 'vitest';

const appwriteInit = vi.hoisted(() => vi.fn());
const createJWT = vi.hoisted(() => vi.fn().mockResolvedValue({ jwt: 'test-jwt' }));

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: () => ({
		upload: { appwriteInit }
	})
}));

vi.mock('$lib/server/appwrite', () => ({
	createSessionClient: () => ({ account: { createJWT } })
}));

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { POST } from './+server';

function makeRequest(body: unknown) {
	const url = new URL('http://localhost/api/upload/appwrite/init');
	return {
		locals: { user: { $id: 'user-1', labels: ['plus'] } },
		request: new Request(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		platform: undefined
	} as never;
}

describe('/api/upload/appwrite/init POST', () => {
	beforeEach(() => {
		appwriteInit.mockReset();
		createJWT.mockClear();
	});

	it('initializes an Appwrite upload', async () => {
		appwriteInit.mockResolvedValue({
			item: { upload_id: 'aw-1', bucket_id: 'b1' }
		});

		const response = await POST(
			makeRequest({
				filename: 'test.txt',
				size: 1024,
				mime_type: 'text/plain'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.upload_id).toBe('aw-1');
		expect(body.jwt).toBe('test-jwt');
		expect(appwriteInit).toHaveBeenCalledWith({
			filename: 'test.txt',
			size: 1024,
			mime_type: 'text/plain',
			is_main_storage: false
		});
	});

	it('initializes a main-storage Appwrite upload', async () => {
		appwriteInit.mockResolvedValue({
			item: { upload_id: 'aw-2', bucket_id: 'b1' }
		});

		const response = await POST(
			makeRequest({
				filename: 'test.txt',
				size: 1024,
				mime_type: 'text/plain',
				is_main_storage: true
			})
		);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body.jwt).toBe('test-jwt');
		expect(appwriteInit).toHaveBeenCalledWith({
			filename: 'test.txt',
			size: 1024,
			mime_type: 'text/plain',
			is_main_storage: true
		});
	});

	it('returns 401 when user is missing', async () => {
		const url = new URL('http://localhost/api/upload/appwrite/init');
		const response = await POST({
			locals: { user: null },
			request: new Request(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ filename: 'test.txt', size: 1024, mime_type: 'text/plain' })
			}),
			platform: undefined
		} as never);

		expect(response.status).toBe(401);
	});

	it('returns 400 for invalid body', async () => {
		const response = await POST(makeRequest({ size: 1024, mime_type: 'text/plain' }));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('Validation failed');
	});

	it('returns 500 on SDK error', async () => {
		appwriteInit.mockRejectedValue(new Error('Backend error'));

		const response = await POST(
			makeRequest({
				filename: 'test.txt',
				size: 1024,
				mime_type: 'text/plain'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error).toBe('Failed to initialize Appwrite upload');
	});
});
