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

import { GET, POST } from './+server';

function makeRequest(params?: Record<string, string>, body?: unknown, method = 'GET') {
	const url = new URL('http://localhost/api/folders');
	if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
	return {
		params: {},
		locals: { user: { $id: 'user-1', labels: ['admin'] }, platform: undefined },
		url,
		request: new Request(url, {
			method,
			headers: body ? { 'Content-Type': 'application/json' } : {},
			body: body ? JSON.stringify(body) : undefined
		})
	} as never;
}

describe('/api/folders GET', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 200 with folder list', async () => {
		mockClient.folders.list.mockResolvedValue({
			items: [
				{
					id: 'folder-1',
					name: 'Documents',
					user_id: 'user-1',
					parent_id: null,
					is_trashed: false,
					created_at: 1715040000,
					updated_at: 1715040000
				}
			],
			page: { next_cursor: null, limit: 50 }
		});

		const response = await GET(makeRequest());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockClient.folders.list).toHaveBeenCalledWith(
			{ parent_id: null, trash: 'active', cursor: undefined, limit: 50 },
			undefined,
			{ asUser: undefined }
		);
		expect(body).toHaveProperty('items');
		expect(body.items).toHaveLength(1);
		expect(body.items[0]).toMatchObject({
			$id: 'folder-1',
			name: 'Documents'
		});
		expect(body).toEqual({
			items: expect.any(Array),
			next_cursor: null,
			limit: 50
		});
	});

	it('returns 200 with parentId filter', async () => {
		mockClient.folders.list.mockResolvedValue({
			items: [],
			page: { next_cursor: null, limit: 50 }
		});

		const response = await GET(makeRequest({ parentId: 'parent-1' }));

		expect(response.status).toBe(200);
		expect(mockClient.folders.list).toHaveBeenCalledWith(
			{ parent_id: 'parent-1', trash: 'active', cursor: undefined, limit: 50 },
			undefined,
			{ asUser: undefined }
		);
	});

	it('returns 200 with trash=true', async () => {
		mockClient.folders.list.mockResolvedValue({
			items: [],
			page: { next_cursor: null, limit: 50 }
		});

		const response = await GET(makeRequest({ trash: 'true' }));

		expect(response.status).toBe(200);
		expect(mockClient.folders.list).toHaveBeenCalledWith(
			{ parent_id: null, trash: 'trashed', cursor: undefined, limit: 50 },
			undefined,
			{ asUser: undefined }
		);
	});

	it('returns 401 when no user', async () => {
		const response = await GET({
			params: {},
			locals: {},
			url: new URL('http://localhost/api/folders')
		} as never);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toEqual({ error: 'Unauthorized' });
	});

	it('returns 403 when targetUserId for non-admin user', async () => {
		const response = await GET({
			params: {},
			locals: { user: { $id: 'user-1', labels: [] } },
			url: new URL('http://localhost/api/folders?targetUserId=user-2')
		} as never);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body).toEqual({ error: 'Forbidden' });
	});

	it('returns 500 when SDK throws an error', async () => {
		mockClient.folders.list.mockRejectedValue(new Error('SDK error'));

		const response = await GET(makeRequest());

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body).toEqual({ error: 'Failed to list folders' });
	});
});

describe('/api/folders POST', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 200 and creates a folder', async () => {
		mockClient.folders.create.mockResolvedValue({
			item: {
				id: 'folder-new',
				name: 'New Folder',
				user_id: 'user-1',
				parent_id: null,
				is_trashed: false,
				created_at: 1715040000,
				updated_at: 1715040000
			}
		});

		const response = await POST(makeRequest(undefined, { name: 'New Folder' }, 'POST'));
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockClient.folders.create).toHaveBeenCalledWith({
			name: 'New Folder'
		});
		expect(body).toMatchObject({
			$id: 'folder-new',
			name: 'New Folder'
		});
	});

	it('returns 400 with invalid body (Zod fail)', async () => {
		const response = await POST(makeRequest(undefined, {}, 'POST'));

		expect(response.status).toBe(400);
		const body = await response.json();
		expect(body.error).toBe('Validation error');
		expect(body.details).toBeDefined();
	});

	it('returns 401 when no user', async () => {
		const response = await POST({
			params: {},
			locals: {},
			url: new URL('http://localhost/api/folders'),
			request: new Request('http://localhost/api/folders', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'test' })
			})
		} as never);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toEqual({ error: 'Unauthorized' });
	});

	it('returns 500 when SDK throws an error', async () => {
		mockClient.folders.create.mockRejectedValue(new Error('SDK error'));

		const response = await POST(makeRequest(undefined, { name: 'Test' }, 'POST'));

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body).toEqual({ error: 'Failed to create folder' });
	});
});
