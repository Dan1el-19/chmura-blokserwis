import { beforeEach, describe, expect, it, vi } from 'vitest';

const r2Init = vi.hoisted(() => vi.fn());

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: () => ({
		upload: { r2Init }
	})
}));

vi.mock('$lib/server/storage/r2-url', () => ({
	assertPresignedUrlMatchesR2Config: vi.fn()
}));

vi.mock('$lib/server/runtime-env', () => ({
	requireRuntimeEnv: () => 'configured-value'
}));

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { POST } from './+server';

function makeRequest(body: unknown, labels: string[] = ['plus']) {
	const url = new URL('http://localhost/api/upload/r2/init');
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

describe('/api/upload/r2/init POST', () => {
	beforeEach(() => {
		r2Init.mockReset();
	});

	it('initializes a standard R2 upload', async () => {
		r2Init.mockResolvedValue({
			item: { presigned_url: 'https://r2.example.com/upload' }
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
		expect(body).toEqual({ presigned_url: 'https://r2.example.com/upload' });
		expect(r2Init).toHaveBeenCalledWith({
			filename: 'test.txt',
			size: 1024,
			mime_type: 'text/plain',
			is_main_storage: false
		});
	});

	it('initializes a main-storage upload for plus user', async () => {
		r2Init.mockResolvedValue({
			item: { presigned_url: 'https://r2.example.com/upload' }
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
		expect(body).toEqual({ presigned_url: 'https://r2.example.com/upload' });
		expect(r2Init).toHaveBeenCalledWith({
			filename: 'test.txt',
			size: 1024,
			mime_type: 'text/plain',
			is_main_storage: true
		});
	});

	it('initializes with optional folder_id', async () => {
		r2Init.mockResolvedValue({
			item: { presigned_url: 'https://r2.example.com/upload' }
		});

		const response = await POST(
			makeRequest({
				filename: 'test.txt',
				size: 1024,
				mime_type: 'text/plain',
				folder_id: 'folder-1'
			})
		);

		expect(response.status).toBe(200);
		expect(r2Init).toHaveBeenCalledWith({
			filename: 'test.txt',
			size: 1024,
			mime_type: 'text/plain',
			is_main_storage: false,
			folder_id: 'folder-1'
		});
	});

	it('returns 401 when user is missing', async () => {
		const url = new URL('http://localhost/api/upload/r2/init');
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

	it('returns 403 for basic user attempting main-storage upload', async () => {
		const response = await POST(
			makeRequest(
				{
					filename: 'test.txt',
					size: 1024,
					mime_type: 'text/plain',
					is_main_storage: true
				},
				['basic']
			)
		);

		expect(response.status).toBe(403);
	});

	it('returns 400 for invalid body (missing filename)', async () => {
		const response = await POST(
			makeRequest({
				size: 1024,
				mime_type: 'text/plain'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(400);
		expect(body.error).toBe('Validation failed');
	});

	it('returns 500 on SDK error', async () => {
		r2Init.mockRejectedValue(new Error('Backend error'));

		const response = await POST(
			makeRequest({
				filename: 'test.txt',
				size: 1024,
				mime_type: 'text/plain'
			})
		);
		const body = await response.json();

		expect(response.status).toBe(500);
		expect(body.error).toBe('Failed to initialize upload');
	});
});
