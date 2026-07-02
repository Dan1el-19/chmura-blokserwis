import { beforeEach, describe, expect, it, vi } from 'vitest';

const uploadFail = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: () => ({
		upload: { uploadFail }
	})
}));

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { POST } from './+server';

function makeRequest(body: unknown, labels: string[] = ['plus']) {
	const url = new URL('http://localhost/api/upload/fail');
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

describe('/api/upload/fail POST', () => {
	beforeEach(() => {
		uploadFail.mockReset();
	});

	it('marks upload as failed', async () => {
		uploadFail.mockResolvedValue({
			item: { success: true }
		});

		const response = await POST(makeRequest({ upload_id: 'up-1' }));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toEqual({ success: true });
		expect(uploadFail).toHaveBeenCalledWith('up-1');
	});

	it('marks main-storage upload as failed', async () => {
		uploadFail.mockResolvedValue({
			item: { success: true }
		});

		const response = await POST(makeRequest({ upload_id: 'up-2', is_main_storage: true }));

		expect(response.status).toBe(200);
		expect(uploadFail).toHaveBeenCalledWith('up-2');
	});

	it('returns 401 when user is missing', async () => {
		const url = new URL('http://localhost/api/upload/fail');
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
		uploadFail.mockRejectedValue(new Error('Upload not found'));

		const response = await POST(makeRequest({ upload_id: 'up-1' }));
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error).toBe('Failed to fail upload');
	});
});
