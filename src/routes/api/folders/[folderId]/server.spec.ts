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
	const url = new URL('http://localhost/api/folders/folder-1');
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

describe('/api/folders/[folderId] GET', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 200 and fetches folder metadata', async () => {
		mockClient.folders.get.mockResolvedValue({
			item: {
				id: 'folder-1',
				name: 'Documents',
				user_id: 'user-1',
				parent_id: null,
				is_trashed: false,
				created_at: 1715040000,
				updated_at: 1715040000
			}
		});

		const response = await GET(makeRequest());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockClient.folders.get).toHaveBeenCalledWith('folder-1', undefined, {
			asUser: undefined
		});
		expect(body).toMatchObject({
			$id: 'folder-1',
			name: 'Documents'
		});
	});

	it('returns 401 when no user', async () => {
		const response = await GET({
			params: { folderId: 'folder-1' },
			locals: {},
			url: new URL('http://localhost/api/folders/folder-1')
		} as never);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toEqual({ error: 'Unauthorized' });
	});

	it('returns 500 when SDK throws an error', async () => {
		mockClient.folders.get.mockRejectedValue(new Error('SDK error'));

		const response = await GET(makeRequest());

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body).toEqual({ error: 'Failed to get folder' });
	});
});

describe('/api/folders/[folderId] DELETE', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 200 and deletes the folder', async () => {
		mockClient.folders.delete.mockResolvedValue(undefined);

		const response = await DELETE(makeRequest());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockClient.folders.delete).toHaveBeenCalledWith('folder-1', undefined, {
			permanent: false,
			asUser: undefined
		});
		expect(body).toEqual({ success: true });
	});

	it('returns 200 with permanent=true', async () => {
		mockClient.folders.delete.mockResolvedValue(undefined);

		const response = await DELETE(makeRequest({ permanent: 'true' }));

		expect(response.status).toBe(200);
		expect(mockClient.folders.delete).toHaveBeenCalledWith('folder-1', undefined, {
			permanent: true,
			asUser: undefined
		});
	});

	it('returns 401 when no user', async () => {
		const response = await DELETE({
			params: { folderId: 'folder-1' },
			locals: {},
			url: new URL('http://localhost/api/folders/folder-1'),
			request: new Request('http://localhost/api/folders/folder-1', { method: 'DELETE' })
		} as never);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toEqual({ error: 'Unauthorized' });
	});

	it('returns 500 when SDK throws an error', async () => {
		mockClient.folders.delete.mockRejectedValue(new Error('SDK error'));

		const response = await DELETE(makeRequest());

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body).toEqual({ error: 'Failed to delete folder' });
	});
});

describe('/api/folders/[folderId] PATCH', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 200 and renames the folder', async () => {
		mockClient.folders.update.mockResolvedValue({
			item: {
				id: 'folder-1',
				name: 'Renamed Folder',
				user_id: 'user-1',
				parent_id: null,
				is_trashed: false,
				created_at: 1715040000,
				updated_at: 1715040000
			}
		});

		const response = await PATCH(makeRequest(undefined, { name: 'Renamed Folder' }, 'PATCH'));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockClient.folders.update).toHaveBeenCalledWith(
			'folder-1',
			{ name: 'Renamed Folder' },
			undefined,
			{ asUser: undefined }
		);
		expect(body).toMatchObject({
			$id: 'folder-1',
			name: 'Renamed Folder'
		});
	});

	it('returns 200 and moves the folder to a different parent', async () => {
		mockClient.folders.bulkMove.mockResolvedValue(undefined);

		const response = await PATCH(makeRequest(undefined, { parentFolderId: 'parent-2' }, 'PATCH'));

		expect(response.status).toBe(200);
		expect(mockClient.folders.bulkMove).toHaveBeenCalledWith(
			{ ids: ['folder-1'], parent_id: 'parent-2' },
			undefined,
			{ asUser: undefined }
		);
		const body = await response.json();
		expect(body).toEqual({ success: true });
	});

	it('returns 401 when no user', async () => {
		const response = await PATCH({
			params: { folderId: 'folder-1' },
			locals: {},
			url: new URL('http://localhost/api/folders/folder-1'),
			request: new Request('http://localhost/api/folders/folder-1', {
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
		mockClient.folders.update.mockRejectedValue(new Error('SDK error'));

		const response = await PATCH(makeRequest(undefined, { name: 'Test' }, 'PATCH'));

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body).toEqual({ error: 'Failed to update folder' });
	});
});

describe('/api/folders/[folderId] POST', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 200 and restores the folder', async () => {
		mockClient.folders.restore.mockResolvedValue(undefined);

		const response = await POST(makeRequest(undefined, { action: 'restore' }, 'POST'));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockClient.folders.restore).toHaveBeenCalledWith('folder-1', undefined, {
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
			params: { folderId: 'folder-1' },
			locals: {},
			url: new URL('http://localhost/api/folders/folder-1'),
			request: new Request('http://localhost/api/folders/folder-1', {
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
