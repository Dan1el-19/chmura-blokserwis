import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { create } from '@bufbuild/protobuf';
import {
	CatalogFileType,
	CatalogSortBy,
	CatalogSortDirection,
	EntrySchema
} from './gen/unisourcecfl/catalog/v1/catalog_pb.js';
import { CloudState } from './cloud-state.svelte.js';
import { EntryKind, SpaceKind, StorageLocation } from './gen/unisourcecfl/catalog/v1/catalog_pb.js';
import { UploadMode, UploadState } from './gen/unisourcecfl/upload/v1/upload_pb.js';

const api = vi.hoisted(() => ({
	getMe: vi.fn(),
	getSpaces: vi.fn(),
	getUploadLimits: vi.fn(),
	listEntries: vi.fn(),
	listTrash: vi.fn(),
	getEntry: vi.fn(),
	createUpload: vi.fn(),
	completeUpload: vi.fn(),
	cancelUpload: vi.fn(),
	retryUpload: vi.fn(),
	getUpload: vi.fn(),
	multipartUploads: {},
	uploadToTarget: vi.fn()
}));
vi.mock('./api.js', () => ({
	identity: { getMe: api.getMe },
	catalog: { getSpaces: api.getSpaces, listEntries: api.listEntries, getEntry: api.getEntry },
	trash: { listTrash: api.listTrash },
	storageSettings: { getUploadLimits: api.getUploadLimits },
	multipartUploads: api.multipartUploads,
	uploads: api
}));
vi.mock('./upload.js', async (original) => ({
	...(await original<typeof import('./upload.js')>()),
	calculateMd5Base64: vi.fn().mockResolvedValue('md5'),
	uploadToTarget: api.uploadToTarget
}));
beforeEach(() => {
	vi.resetAllMocks();
	localStorage.clear();
	api.getMe.mockResolvedValue({});
	api.getSpaces.mockResolvedValue({
		spaces: [
			{ id: 'private', kind: SpaceKind.PRIVATE },
			{ id: 'shared', kind: SpaceKind.SHARED }
		]
	});
	api.getUploadLimits.mockResolvedValue({ maxUploadBytes: 100_000_000n, canManage: false });
	api.listEntries.mockResolvedValue({ entries: [], nextPageToken: '' });
	api.listTrash.mockResolvedValue({ items: [], nextPageToken: '' });
	api.createUpload.mockImplementation(async () => ({
		session: {
			id: crypto.randomUUID(),
			state: UploadState.OPEN,
			storageLocation: StorageLocation.R2,
			attemptId: 'attempt-1'
		},
		target: { url: 'https://upload.example', headers: {} }
	}));
	api.completeUpload.mockResolvedValue({});
	api.cancelUpload.mockResolvedValue({});
	api.uploadToTarget.mockResolvedValue(undefined);
});
it('shares account initialization and fresh lists across views without duplicate requests', async () => {
	const app = new CloudState();
	app.activate('alice');
	await Promise.all([app.ensureAccount(), app.ensureAccount()]);
	expect(api.getMe).toHaveBeenCalledTimes(1);
	const list = app.list('files', 'private', '');
	await Promise.all([app.load(list), app.load(list)]);
	await app.load(list);
	expect(api.listEntries).toHaveBeenCalledTimes(1);
	expect(app.list('files', 'private', '')).toBe(list);
});
it('discards a late page after the filter changes', async () => {
	const app = new CloudState();
	const oldList = app.list('files', 'private', '');
	api.listEntries.mockResolvedValueOnce({ entries: [], nextPageToken: 'next' });
	await app.load(oldList);
	app.activeListKey = oldList.key;
	let finish!: (value: object) => void;
	api.listEntries.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
	const oldPage = app.load(oldList, { next: true });
	app.setFileType('private', CatalogFileType.PDF);
	const newList = app.list('files', 'private', '');
	api.listEntries.mockResolvedValueOnce({ entries: [{ id: 'pdf', name: 'report.pdf', kind: EntryKind.FILE }], nextPageToken: '' });
	await app.load(newList);
	finish({ entries: [{ id: 'stale', name: 'old.png', kind: EntryKind.FILE }], nextPageToken: '' });
	await oldPage;
	expect(newList.entries.map((entry) => entry.id)).toEqual(['pdf']);
	expect(oldList.entries).toEqual([]);
	expect(api.listEntries.mock.calls.at(-1)?.[0]).toMatchObject({ fileType: CatalogFileType.PDF, pageToken: '' });
});
it('refreshes every loaded page atomically and retains cached data during refresh', async () => {
	const app = new CloudState();
	const list = app.list('files', 'private', '');
	const entry = { id: 'one', name: 'one', kind: EntryKind.FILE };
	api.listEntries
		.mockResolvedValueOnce({ entries: [entry], nextPageToken: 'page2' })
		.mockResolvedValueOnce({ entries: [{ ...entry, id: 'two' }], nextPageToken: '' });
	await app.load(list);
	await app.load(list, { next: true });
	let finish!: (value: object) => void;
	api.listEntries
		.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				})
		)
		.mockResolvedValueOnce({
			entries: [{ ...entry, id: 'two', name: 'updated' }],
			nextPageToken: ''
		});
	const refresh = app.load(list, { force: true });
	expect(list.entries).toHaveLength(2);
	expect(list.refreshing).toBe(true);
	expect(list.loading).toBe(false);
	finish({ entries: [entry], nextPageToken: 'new-page2' });
	await refresh;
	expect(list.entries.map((item) => item.name)).toEqual(['one', 'updated']);
	expect(api.listEntries.mock.calls.at(-1)?.[0].pageToken).toBe('new-page2');
});
it('resets pagination for the new sort and discards a late previous-page response', async () => {
	const app = new CloudState();
	app.activate('alice');
	const oldList = app.list('files', 'private', '');
	api.listEntries.mockResolvedValueOnce({
		entries: [{ id: 'old-first', spaceId: 'private', name: 'old first', kind: EntryKind.FILE }],
		nextPageToken: 'old-next'
	});
	await app.load(oldList);
	oldList.scrollTop = 700;
	let finishOldPage!: (response: { entries: object[]; nextPageToken: string }) => void;
	api.listEntries.mockImplementationOnce(
		() => new Promise((resolve) => { finishOldPage = resolve; })
	);
	const oldPage = app.load(oldList, { next: true });
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(2);
	const setSort = (app as unknown as {
		setSort?: (spaceId: string, sort: { by: 'SIZE'; direction: 'DESC' }) => void;
	}).setSort;
	expect(setSort).toBeTypeOf('function');
	setSort?.call(app, 'private', { by: 'SIZE', direction: 'DESC' });
	expect(oldList.entries).toEqual([]);
	expect(oldList.nextPageToken).toBe('');
	expect(oldList.scrollTop).toBe(0);

	const newList = app.list('files', 'private', '');
	app.activeListKey = newList.key;
	api.listEntries.mockResolvedValueOnce({
		entries: [{ id: 'size-first', spaceId: 'private', name: 'large', kind: EntryKind.FILE }],
		nextPageToken: ''
	});
	await app.load(newList);
	expect(api.listEntries.mock.calls[2]?.[0]).toMatchObject({
		sortBy: CatalogSortBy.SIZE,
		sortDirection: CatalogSortDirection.DESC,
		pageToken: ''
	});
	finishOldPage({
		entries: [{ id: 'stale-next', spaceId: 'private', name: 'stale', kind: EntryKind.FILE }],
		nextPageToken: ''
	});
	await oldPage;
	expect(oldList.entries).toEqual([]);
	expect(newList.entries.map((entry) => entry.id)).toEqual(['size-first']);
});

it('stores the sort independently for each space and resets it on account changes', () => {
	const app = new CloudState();
	app.activate('alice');
	const setSort = (app as unknown as {
		setSort?: (spaceId: string, sort: { by: 'CREATED_AT'; direction: 'ASC' }) => void;
	}).setSort;
	expect(setSort).toBeTypeOf('function');
	setSort?.call(app, 'private', { by: 'CREATED_AT', direction: 'ASC' });
	expect(app.sortFor('private')).toEqual({ by: 'CREATED_AT', direction: 'ASC' });
	expect(app.sortFor('shared')).toEqual({ by: 'NAME', direction: 'ASC' });
	app.activate('bob');
	expect(app.sortFor('private')).toEqual({ by: 'NAME', direction: 'ASC' });
});
it('continues a queue across navigation and snapshots each batch destination and mode', async () => {
	const app = new CloudState();
	await app.ensureAccount();
	let finish!: () => void;
	api.uploadToTarget.mockImplementationOnce(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			})
	);
	app.transfers.enqueue(
		[new File(['a'], 'one'), new File(['b'], 'two')],
		{ spaceId: 'private', parentId: 'folder', mode: UploadMode.AUTO, label: 'Personal / Folder' },
		100
	);
	await expect.poll(() => api.uploadToTarget.mock.calls.length).toBe(1);
	app.activeListKey = 'files:shared:';
	app.transfers.enqueue(
		[new File(['c'], 'three')],
		{ spaceId: 'shared', mode: UploadMode.RUSTFS, label: 'Main' },
		100
	);
	expect(api.uploadToTarget.mock.calls[0][3].signal.aborted).toBe(false);
	finish();
	await expect.poll(() => app.transfers.pendingCount).toBe(0);
	expect(
		api.createUpload.mock.calls.map((call) => [
			call[0].spaceId,
			call[0].parentId,
			call[0].uploadMode
		])
	).toEqual([
		['private', 'folder', UploadMode.AUTO],
		['private', 'folder', UploadMode.AUTO],
		['shared', undefined, UploadMode.RUSTFS]
	]);
	expect(app.transfers.tasks.map((task) => task.phase)).toEqual(['done', 'done', 'done']);
});
it('cancels a queued task without losing later tasks and releases file references', async () => {
	const app = new CloudState();
	let finish!: () => void;
	api.uploadToTarget.mockImplementationOnce(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			})
	);
	app.transfers.enqueue(
		[new File(['a'], 'one'), new File(['b'], 'two'), new File(['c'], 'three')],
		{ spaceId: 'private', mode: UploadMode.AUTO, label: 'Personal' },
		100
	);
	await expect.poll(() => api.uploadToTarget.mock.calls.length).toBe(1);
	app.transfers.cancel(app.transfers.tasks[1].id);
	finish();
	await expect.poll(() => app.transfers.pendingCount).toBe(0);
	expect(api.createUpload.mock.calls.map((call) => call[0].name)).toEqual(['one', 'three']);
	expect(app.transfers.tasks[1].phase).toBe('cancelled');
	expect(app.transfers.tasks.every((task) => task.file === undefined)).toBe(true);
});
it('resets data on account change and ignores a late response from the old session', async () => {
	const app = new CloudState();
	app.activate('alice');
	let finish!: (value: object) => void;
	api.getSpaces.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			})
	);
	const old = app.ensureAccount();
	await expect.poll(() => api.getSpaces.mock.calls.length).toBe(1);
	app.activate('bob');
	await app.ensureAccount();
	finish({ spaces: [{ id: 'alice-private', kind: SpaceKind.PRIVATE }] });
	await old;
	expect(app.spaces.map((space) => space.id)).toEqual(['private', 'shared']);
});
it('isolates saved preferences per account and safely handles invalid stored values', () => {
	const app = new CloudState();
	app.activate('alice');
	app.setDefaultUploadMode(UploadMode.RUSTFS);
	app.activate('bob');
	expect(app.defaultUploadMode).toBe(UploadMode.AUTO);
	app.setDefaultUploadMode(UploadMode.R2);
	app.activate('alice');
	expect(app.defaultUploadMode).toBe(UploadMode.RUSTFS);
});
it('keeps a successful transfer successful when catalogue refresh fails', async () => {
	const app = new CloudState();
	await app.ensureAccount();
	const list = app.list('files', 'private', '');
	await app.load(list);
	app.activeListKey = list.key;
	api.listEntries.mockRejectedValueOnce(new Error('catalogue unavailable'));
	app.transfers.enqueue(
		[new File(['x'], 'ok.txt')],
		{ spaceId: 'private', mode: UploadMode.AUTO, label: 'Personal' },
		100
	);
	await expect.poll(() => app.transfers.pendingCount).toBe(0);
	await expect.poll(() => list.error).toBe('catalogue unavailable');
	expect(app.transfers.tasks[0].phase).toBe('done');
	expect(list.initialized).toBe(true);
});
it('ignores a stale response after a mutation and fetches the updated list', async () => {
	const app = new CloudState();
	const list = app.list('files', 'private', '');
	app.activeListKey = list.key;
	let finish!: (value: object) => void;
	api.listEntries
		.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				})
		)
		.mockResolvedValueOnce({
			entries: [{ id: 'new', name: 'new', kind: EntryKind.FILE }],
			nextPageToken: ''
		});
	const loading = app.load(list);
	app.changed('private', '');
	finish({ entries: [{ id: 'old', name: 'old', kind: EntryKind.FILE }], nextPageToken: '' });
	await loading;
	await expect.poll(() => list.entries.map((entry) => entry.id)).toEqual(['new']);
	expect(list.initialized).toBe(true);
});
it('does not replace cached entries when a background refresh fails', async () => {
	const app = new CloudState();
	const list = app.list('files', 'private', '');
	api.listEntries.mockResolvedValueOnce({
		entries: [{ id: 'kept', name: 'kept', kind: EntryKind.FILE }],
		nextPageToken: ''
	});
	await app.load(list);
	api.listEntries.mockRejectedValueOnce(new Error('offline'));
	await app.load(list, { force: true });
	expect(list.entries[0].id).toBe('kept');
	expect(list.error).toBe('offline');
	expect(list.loading).toBe(false);
});
it('invalidates only the upload destination while a different space is visible', async () => {
	const app = new CloudState();
	const personal = app.list('files', 'private', 'folder'),
		shared = app.list('files', 'shared', '');
	personal.initialized = true;
	personal.dirty = false;
	shared.initialized = true;
	shared.dirty = false;
	app.activeListKey = shared.key;
	app.changed('private', 'folder');
	expect(personal.dirty).toBe(true);
	expect(shared.dirty).toBe(false);
	expect(api.listEntries).not.toHaveBeenCalled();
});
it('continues after a failed task and stops the whole queue on cancellation', async () => {
	const app = new CloudState();
	api.uploadToTarget.mockRejectedValueOnce(new Error('first failed')).mockImplementationOnce(
		(_file, _url, _headers, { signal }) =>
			new Promise((_resolve, reject) => {
				signal.addEventListener('abort', () => reject(new DOMException('cancelled', 'AbortError')));
			})
	);
	app.transfers.enqueue(
		[new File(['a'], 'bad'), new File(['b'], 'active'), new File(['c'], 'queued')],
		{ spaceId: 'private', mode: UploadMode.R2, label: 'Personal' },
		100
	);
	await expect.poll(() => api.uploadToTarget).toHaveBeenCalledTimes(2);
	app.transfers.cancelAll();
	await expect.poll(() => app.transfers.pendingCount).toBe(0);
	expect(app.transfers.tasks.map((task) => task.phase)).toEqual([
		'error',
		'cancelled',
		'cancelled'
	]);
	expect(api.createUpload).toHaveBeenCalledTimes(2);
});

afterEach(() => vi.restoreAllMocks());
it('keeps visited files and trash for fifteen minutes and refreshes stale data in the background', async () => {
	const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
	const app = new CloudState();
	const list = app.list('files', 'private', '');
	const bin = app.list('trash', 'private', '');
	api.listEntries.mockResolvedValue({
		entries: [{ id: 'one', name: 'cached', kind: EntryKind.FILE }],
		nextPageToken: ''
	});
	await app.load(list);
	await app.load(bin);
	now.mockReturnValue(1_000_000 + 14 * 60_000);
	await app.load(list);
	await app.load(bin);
	expect(api.listEntries).toHaveBeenCalledTimes(1);
	expect(api.listTrash).toHaveBeenCalledTimes(1);
	now.mockReturnValue(1_000_000 + 15 * 60_000);
	let finish!: (value: object) => void;
	api.listEntries.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finish = resolve;
			})
	);
	const refresh = app.load(list);
	expect(list.entries[0].name).toBe('cached');
	expect(list.loading).toBe(false);
	expect(list.refreshing).toBe(true);
	finish({ entries: [{ id: 'two', name: 'updated', kind: EntryKind.FILE }], nextPageToken: '' });
	await refresh;
	expect(list.entries[0].name).toBe('updated');
});
it('removes only successful transfers five seconds after completion', async () => {
	const app = new CloudState();
	app.transfers.enqueue(
		[new File([new Uint8Array(101)], 'invalid'), new File(['a'], 'done')],
		{ spaceId: 'private', mode: UploadMode.AUTO, label: 'Personal' },
		100
	);
	await expect.poll(() => app.transfers.pendingCount).toBe(0);
	expect(app.transfers.tasks[1].phase).toBe('done');
	await expect.poll(() => app.transfers.tasks.length, { timeout: 6500 }).toBe(1);
	expect(app.transfers.tasks[0].phase).toBe('error');
	app.reset();
});

it('invalidates cached ancestor totals after restoring into an unvisited nested folder', async () => {
	const app = new CloudState();
	const root = app.list('files', 'private', '');
	api.listEntries.mockResolvedValueOnce({
		entries: [{ id: 'A', spaceId: 'private', name: 'A', kind: EntryKind.FOLDER, sizeBytes: 10n }],
		nextPageToken: ''
	});
	await app.load(root);
	app.activeListKey = 'trash:private:';
	app.changed(
		'private',
		'B',
		create(EntrySchema, {
			id: 'restored',
			parentId: 'B',
			spaceId: 'private',
			kind: EntryKind.FILE,
			sizeBytes: 5n
		})
	);
	expect(root.dirty).toBe(true);
	expect(root.entries[0].sizeBytes).toBe(10n);
});
