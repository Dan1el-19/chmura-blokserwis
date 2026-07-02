import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockClient = vi.hoisted(() => ({
	myFiles: {
		list: vi.fn(),
		listTrash: vi.fn(),
		move: vi.fn()
	},
	userFiles: {
		get: vi.fn(),
		delete: vi.fn(),
		update: vi.fn(),
		restore: vi.fn(),
		downloadUrl: vi.fn()
	},
	folders: {
		list: vi.fn(),
		get: vi.fn(),
		create: vi.fn(),
		delete: vi.fn(),
		update: vi.fn(),
		restore: vi.fn(),
		bulkMove: vi.fn()
	}
}));

vi.mock('$lib/server/unisource', () => ({
	createUserUnisourceClient: () => mockClient
}));

vi.mock('$env/dynamic/private', () => ({ env: {} }));

import { GET, DELETE, PATCH, POST } from './+server';

function makeRequest(params?: Record<string, string>, body?: unknown, method = 'GET') {
	const url = new URL('http://localhost/api/files/file-1');
	if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
	return {
		params: { fileId: 'file-1', folderId: 'folder-1' },
		locals: { user: { $id: 'user-1', labels: ['admin'] }, platform: undefined },
		url,
		request: new Request(url, {
			method,
			headers: body ? { 'Content-Type': 'application/json' } : {},
			body: body ? JSON.stringify(body) : undefined
		})
	} as never;
}

describe('/api/files/[fileId] GET', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 200 and fetches file metadata', async () => {
		mockClient.userFiles.get.mockResolvedValue({
			item: {
				id: 'file-1',
				filename: 'readme.md',
				size: 100,
				mime_type: 'text/markdown',
				storage_destination: 'r2',
				user_id: 'user-1',
				folder_id: null,
				is_trashed: false,
				created_at: 1715040000,
				updated_at: 1715040000
			}
		});

		const response = await GET(makeRequest());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockClient.userFiles.get).toHaveBeenCalledWith('file-1', undefined, {
			asUser: undefined
		});
		expect(body).toMatchObject({
			$id: 'file-1',
			name: 'readme.md',
			size: 100,
			mimeType: 'text/markdown'
		});
	});

	it('returns 200 with download=true (calls downloadUrl)', async () => {
		mockClient.userFiles.downloadUrl.mockResolvedValue({
			item: {
				download_url: 'https://example.com/download/file-1',
				expires_at: 1760000000
			}
		});

		const response = await GET(makeRequest({ download: 'true' }));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockClient.userFiles.downloadUrl).toHaveBeenCalledWith('file-1', undefined, {
			asUser: undefined
		});
		expect(mockClient.userFiles.get).not.toHaveBeenCalled();
		expect(body).toEqual({
			downloadUrl: 'https://example.com/download/file-1',
			expiresAt: 1760000000
		});
	});

	it('returns 401 when no user', async () => {
		const response = await GET({
			params: { fileId: 'file-1' },
			locals: {},
			url: new URL('http://localhost/api/files/file-1')
		} as never);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toEqual({ error: 'Unauthorized' });
	});

	it('returns 500 when SDK throws an error', async () => {
		mockClient.userFiles.get.mockRejectedValue(new Error('SDK error'));

		const response = await GET(makeRequest());

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body).toEqual({ error: 'Failed to get file' });
	});
});

describe('/api/files/[fileId] DELETE', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 200 and deletes the file', async () => {
		mockClient.userFiles.delete.mockResolvedValue(undefined);

		const response = await DELETE(makeRequest());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockClient.userFiles.delete).toHaveBeenCalledWith('file-1', undefined, {
			permanent: false,
			asUser: undefined
		});
		expect(body).toEqual({ success: true });
	});

	it('returns 200 with permanent=true', async () => {
		mockClient.userFiles.delete.mockResolvedValue(undefined);

		const response = await DELETE(makeRequest({ permanent: 'true' }));

		expect(response.status).toBe(200);
		expect(mockClient.userFiles.delete).toHaveBeenCalledWith('file-1', undefined, {
			permanent: true,
			asUser: undefined
		});
	});

	it('returns 401 when no user', async () => {
		const response = await DELETE({
			params: { fileId: 'file-1' },
			locals: {},
			url: new URL('http://localhost/api/files/file-1'),
			request: new Request('http://localhost/api/files/file-1', { method: 'DELETE' })
		} as never);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toEqual({ error: 'Unauthorized' });
	});

	it('returns 500 when SDK throws an error', async () => {
		mockClient.userFiles.delete.mockRejectedValue(new Error('SDK error'));

		const response = await DELETE(makeRequest());

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body).toEqual({ error: 'Failed to delete file' });
	});
});

describe('/api/files/[fileId] PATCH', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 200 and renames the file', async () => {
		mockClient.userFiles.update.mockResolvedValue({
			item: {
				id: 'file-1',
				filename: 'new-name.md',
				size: 100,
				mime_type: 'text/markdown',
				storage_destination: 'r2',
				user_id: 'user-1',
				folder_id: null,
				is_trashed: false,
				created_at: 1715040000,
				updated_at: 1715040000
			}
		});

		const response = await PATCH(makeRequest(undefined, { name: 'new-name.md' }, 'PATCH'));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockClient.userFiles.update).toHaveBeenCalledWith(
			'file-1',
			{ filename: 'new-name.md' },
			undefined,
			{ asUser: undefined }
		);
		expect(body).toMatchObject({
			$id: 'file-1',
			name: 'new-name.md'
		});
	});

	it('returns 200 and moves the file to a different folder', async () => {
		mockClient.myFiles.move.mockResolvedValue(undefined);

		const response = await PATCH(makeRequest(undefined, { parentFolderId: 'f2' }, 'PATCH'));

		expect(response.status).toBe(200);
		expect(mockClient.myFiles.move).toHaveBeenCalledWith('file-1', { folder_id: 'f2' }, undefined, {
			asUser: undefined
		});
		const body = await response.json();
		expect(body).toEqual({ success: true });
	});

	it('returns 401 when no user', async () => {
		const response = await PATCH({
			params: { fileId: 'file-1' },
			locals: {},
			url: new URL('http://localhost/api/files/file-1'),
			request: new Request('http://localhost/api/files/file-1', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'test' })
			})
		} as never);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toEqual({ error: 'Unauthorized' });
	});

	it('returns 400 with invalid body (Zod fail)', async () => {
		const response = await PATCH(makeRequest(undefined, { name: '' }, 'PATCH'));

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('Validation error');
		expect(body.details).toBeDefined();
	});

	it('returns 500 when SDK throws an error', async () => {
		mockClient.userFiles.update.mockRejectedValue(new Error('SDK error'));

		const response = await PATCH(makeRequest(undefined, { name: 'test' }, 'PATCH'));

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body).toEqual({ error: 'Failed to update file' });
	});
});

describe('/api/files/[fileId] POST', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 200 and restores the file', async () => {
		mockClient.userFiles.restore.mockResolvedValue(undefined);

		const response = await POST(makeRequest(undefined, { action: 'restore' }, 'POST'));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockClient.userFiles.restore).toHaveBeenCalledWith('file-1', undefined, {
			asUser: undefined
		});
		expect(body).toEqual({ success: true });
	});

	it('returns 400 with unsupported action', async () => {
		const response = await POST(makeRequest(undefined, { action: 'invalid' }, 'POST'));

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body).toEqual({ error: 'Unsupported action' });
	});

	it('returns 401 when no user', async () => {
		const response = await POST({
			params: { fileId: 'file-1' },
			locals: {},
			url: new URL('http://localhost/api/files/file-1'),
			request: new Request('http://localhost/api/files/file-1', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'restore' })
			})
		} as never);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toEqual({ error: 'Unauthorized' });
	});
});
