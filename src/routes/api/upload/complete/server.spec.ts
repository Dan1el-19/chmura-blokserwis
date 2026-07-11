import { beforeEach, describe, expect, it, vi } from 'vitest';

const complete = vi.hoisted(() => vi.fn());
const requestUserUnisourceV2 = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: () => ({
		upload: { complete }
	}),
	requestUserUnisourceV2
}));

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { POST } from './+server';

function makeRequest(body: unknown, labels: string[] = ['plus']) {
	const url = new URL('http://localhost/api/upload/complete');
	return {
		locals: { user: { $id: 'user-1', labels } },
		request: new Request(url, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body)
		}),
		platform: undefined
	} as never;
}

describe('/api/upload/complete POST', () => {
	beforeEach(() => {
		complete.mockReset();
		requestUserUnisourceV2.mockReset();
	});

	it('completes a standard upload', async () => {
		complete.mockResolvedValue({
			item: { id: 'file-1', name: 'test.txt', size: 1024 }
		});

		const response = await POST(makeRequest({ upload_id: 'up-1' }));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ id: 'file-1', name: 'test.txt', size: 1024 });
		expect(complete).toHaveBeenCalledWith('up-1');
	});

	it('completes a main-storage upload for plus user', async () => {
		complete.mockResolvedValue({
			item: { id: 'file-2', name: 'main.txt', size: 2048 }
		});

		const response = await POST(makeRequest({ upload_id: 'up-2', is_main_storage: true }));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ id: 'file-2', name: 'main.txt', size: 2048 });
		expect(complete).toHaveBeenCalledWith('up-2', undefined, { isMainStorage: true });
	});

	it('forwards the Fast Upload migration request', async () => {
		requestUserUnisourceV2.mockResolvedValue({ item: { id: 'up-3', migration_queued: true } });
		await POST(makeRequest({ upload_id: 'up-3', migrate_to_appwrite: true }));
		expect(requestUserUnisourceV2).toHaveBeenCalledWith(
			expect.anything(),
			'POST',
			'/v2/upload/complete',
			{ body: { upload_id: 'up-3', is_main_storage: false, migrate_to_appwrite: true } }
		);
	});

	it('returns 401 when user is missing', async () => {
		const url = new URL('http://localhost/api/upload/complete');
		const response = await POST({
			locals: { user: null },
			request: new Request(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ upload_id: 'up-1' })
			}),
			platform: undefined
		} as never);

		expect(response.status).toBe(401);
	});

	it('returns 403 for basic user with main storage', async () => {
		const response = await POST(
			makeRequest({ upload_id: 'up-1', is_main_storage: true }, ['basic'])
		);

		expect(response.status).toBe(403);
	});

	it('returns 400 for invalid body', async () => {
		const response = await POST(makeRequest({}));
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('Validation failed');
	});

	it('returns 500 on SDK error', async () => {
		complete.mockRejectedValue(new Error('Upload not found'));

		const response = await POST(makeRequest({ upload_id: 'up-1' }));
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error).toBe('Failed to complete upload');
	});
});
