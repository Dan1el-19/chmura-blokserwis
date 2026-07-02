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

import { GET } from './+server';

function makeRequest(params?: Record<string, string>) {
	const url = new URL('http://localhost/api/files');
	if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
	return {
		params: {},
		locals: { user: { $id: 'user-1', labels: ['admin'] }, platform: undefined },
		url,
		request: new Request(url)
	} as never;
}

describe('/api/files GET', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('returns 200 with file list (no params)', async () => {
		mockClient.myFiles.list.mockResolvedValue({
			items: [
				{
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
			],
			page: { next_cursor: null, limit: 50 }
		});

		const response = await GET(makeRequest());
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(mockClient.myFiles.list).toHaveBeenCalledWith(
			{ cursor: undefined, limit: 50 },
			undefined,
			{ asUser: undefined }
		);
		expect(body).toHaveProperty('items');
		expect(body.items).toHaveLength(1);
		expect(body.items[0]).toMatchObject({
			$id: 'file-1',
			name: 'readme.md',
			size: 100,
			mimeType: 'text/markdown'
		});
		expect(body).toEqual({
			items: expect.any(Array),
			next_cursor: null,
			limit: 50
		});
	});

	it('returns 200 with folderId filter', async () => {
		mockClient.myFiles.list.mockResolvedValue({
			items: [],
			page: { next_cursor: null, limit: 50 }
		});

		const response = await GET(makeRequest({ folderId: 'folder-1' }));

		expect(response.status).toBe(200);
		expect(mockClient.myFiles.list).toHaveBeenCalledWith(
			{ folder_id: 'folder-1', cursor: undefined, limit: 50 },
			undefined,
			{ asUser: undefined }
		);
	});

	it('returns 200 with trash=true (calls listTrash)', async () => {
		mockClient.myFiles.listTrash.mockResolvedValue({
			items: [],
			page: { next_cursor: null, limit: 50 }
		});

		const response = await GET(makeRequest({ trash: 'true' }));

		expect(response.status).toBe(200);
		expect(mockClient.myFiles.listTrash).toHaveBeenCalledWith(
			{ cursor: undefined, limit: 50 },
			undefined,
			{ asUser: undefined }
		);
		expect(mockClient.myFiles.list).not.toHaveBeenCalled();
	});

	it('returns 200 with targetUserId for admin', async () => {
		mockClient.myFiles.list.mockResolvedValue({
			items: [],
			page: { next_cursor: null, limit: 50 }
		});

		const response = await GET(makeRequest({ targetUserId: 'user-2' }));

		expect(response.status).toBe(200);
		expect(mockClient.myFiles.list).toHaveBeenCalledWith(
			{ cursor: undefined, limit: 50 },
			undefined,
			{ asUser: 'user-2' }
		);
	});

	it('returns 401 when no user', async () => {
		const response = await GET({
			params: {},
			locals: {},
			url: new URL('http://localhost/api/files')
		} as never);

		expect(response.status).toBe(401);
		const body = await response.json();
		expect(body).toEqual({ error: 'Unauthorized' });
	});

	it('returns 403 when targetUserId for non-admin user', async () => {
		const response = await GET({
			params: {},
			locals: { user: { $id: 'user-1', labels: [] } },
			url: new URL('http://localhost/api/files?targetUserId=user-2')
		} as never);

		expect(response.status).toBe(403);
		const body = await response.json();
		expect(body).toEqual({ error: 'Forbidden' });
	});

	it('returns 500 when SDK throws an error', async () => {
		mockClient.myFiles.list.mockRejectedValue(new Error('SDK error'));

		const response = await GET(makeRequest());

		expect(response.status).toBe(500);
		const body = await response.json();
		expect(body).toEqual({ error: 'Failed to list files' });
	});
});
