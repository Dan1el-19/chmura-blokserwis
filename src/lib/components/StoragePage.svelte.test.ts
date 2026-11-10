import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { Code, ConnectError } from '@connectrpc/connect';
import { page } from '$app/state';
import {
	CatalogSortBy,
	CatalogSortDirection,
	EntryKind,
	SpaceKind,
	StorageLocation,
	type Entry
} from '#lib/gen/unisourcecfl/catalog/v1/catalog_pb.js';
import {
	UploadFailureKind,
	UploadMode,
	UploadState
} from '#lib/gen/unisourcecfl/upload/v1/upload_pb.js';
import StoragePage from './StorageTestShell.svelte';
import { CloudState } from '#lib/cloud-state.svelte.js';
import { UploadTargetError, UploadTransportError } from '#lib/upload.js';

const api = vi.hoisted(() => ({
	getMe: vi.fn(),
	getSpaces: vi.fn(),
	getUploadLimits: vi.fn(),
	getPreview: vi.fn(),
	getDownload: vi.fn(),
	listShares: vi.fn(),
	createShare: vi.fn(),
	updateShare: vi.fn(),
	revokeShare: vi.fn(),
	multipartUploads: {},
	listTrash: vi.fn(),
	listEntries: vi.fn(),
	getEntry: vi.fn(),
	moveEntry: vi.fn(),
	trashEntry: vi.fn(),
	bulkTrashEntries: vi.fn(),
	createUpload: vi.fn(),
	retryUpload: vi.fn(),
	getUpload: vi.fn(),
	completeUpload: vi.fn(),
	cancelUpload: vi.fn(),
	uploadToTarget: vi.fn()
}));

vi.mock('#lib/api.js', () => ({
	identity: { getMe: api.getMe },
	catalog: {
		getSpaces: api.getSpaces,
		listEntries: api.listEntries,
		getEntry: api.getEntry,
		getPreview: api.getPreview,
		getDownload: api.getDownload,
		moveEntry: api.moveEntry
	},
	shareLinks: { listShares: api.listShares, createShare: api.createShare, updateShare: api.updateShare, revokeShare: api.revokeShare },
	trash: { listTrash: api.listTrash, trashEntry: api.trashEntry, bulkTrashEntries: api.bulkTrashEntries },
	uploads: {
		retryUpload: api.retryUpload,
		getUpload: api.getUpload,
		createUpload: api.createUpload,
		completeUpload: api.completeUpload,
		cancelUpload: api.cancelUpload
	},
	storageSettings: { getUploadLimits: api.getUploadLimits },
	multipartUploads: api.multipartUploads
}));

vi.mock('#lib/upload.js', async (importOriginal) => ({
	...(await importOriginal<typeof import('#lib/upload.js')>()),
	MAX_UPLOAD_BYTES: 100_000_000,
	calculateMd5Base64: vi.fn().mockResolvedValue('md5'),
	uploadToTarget: api.uploadToTarget,
	validateUploadSize: vi.fn((size: number, maximum = 100_000_000) => size <= maximum)
}));

vi.mock('$app/state', () => ({
	page: { url: new URL('https://chmura.blokserwis.pl/main') }
}));

vi.mock('$app/navigation', () => ({ goto: vi.fn() }));
vi.mock('$app/paths', () => ({
	resolve: (path: string, params?: { address?: string }) =>
		params?.address ? path.replace('[address]', params.address) : path
}));
vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));

afterEach(() => {
	vi.restoreAllMocks();
});

beforeEach(() => {
	vi.resetAllMocks();
	page.url = new URL('https://chmura.blokserwis.pl/main');
	api.getMe.mockResolvedValue({});
	api.getUploadLimits.mockResolvedValue({ maxUploadBytes: 100_000_000n, canManage: false });
	api.getSpaces.mockResolvedValue({
		spaces: [
			{ id: 'personal-space', kind: SpaceKind.PRIVATE },
			{ id: 'main-space', kind: SpaceKind.SHARED }
		]
	});
	api.listTrash.mockResolvedValue({ items: [], nextPageToken: '' });
	api.listEntries.mockResolvedValue({ entries: [], nextPageToken: '' });
	api.getEntry.mockResolvedValue({ entry: undefined });
	api.getPreview.mockResolvedValue({
		url: 'https://storage.example/preview',
		expiresAt: { seconds: BigInt(Math.floor((Date.now() + 300_000) / 1000)), nanos: 0 },
		contentType: 'image/png',
		mediaKind: 1
	});
	api.getDownload.mockResolvedValue({ url: 'https://storage.example/download' });
	api.listShares.mockResolvedValue({ shares: [] });
	api.createShare.mockResolvedValue({ share: undefined });
	api.updateShare.mockResolvedValue({ share: undefined });
	api.revokeShare.mockResolvedValue({ share: undefined });
	api.moveEntry.mockResolvedValue({ entry: undefined });
	api.trashEntry.mockResolvedValue({});
	api.createUpload.mockResolvedValue({
		session: {
			id: 'upload-1',
			state: UploadState.OPEN,
			storageLocation: StorageLocation.RUSTFS,
			attemptId: 'attempt-1',
			attemptNumber: 1,
			fallbackAllowed: true
		},
		target: { url: 'https://storage.example/signed', headers: {} }
	});
	api.completeUpload.mockResolvedValue({});
	api.cancelUpload.mockResolvedValue({});
	api.uploadToTarget.mockResolvedValue(undefined);
});

it('invalidates both parents, ancestor folder sizes and visited descendants after a move', () => {
	const app = new CloudState();
	const moved = {
		id: 'moved-folder',
		spaceId: 'personal-space',
		parentId: 'new-parent',
		name: 'Moved',
		kind: EntryKind.FOLDER,
		revision: 2
	} as Entry;
	const oldParent = {
		id: 'old-parent',
		spaceId: 'personal-space',
		name: 'Old parent',
		kind: EntryKind.FOLDER,
		revision: 1
	} as Entry;
	const newParent = {
		id: 'new-parent',
		spaceId: 'personal-space',
		name: 'New parent',
		kind: EntryKind.FOLDER,
		revision: 1
	} as Entry;
	const oldList = app.list('files', 'personal-space', 'old-parent');
	oldList.initialized = true;
	oldList.dirty = false;
	oldList.entries = [moved];
	const newList = app.list('files', 'personal-space', 'new-parent');
	newList.initialized = true;
	newList.dirty = false;
	const root = app.list('files', 'personal-space', '');
	root.initialized = true;
	root.dirty = false;
	root.entries = [oldParent, newParent];
	const visited = app.list('files', 'personal-space', 'inside-moved');
	visited.initialized = true;
	visited.dirty = false;
	visited.path = [moved];

	const entryMoved = (app as unknown as { entryMoved?: (spaceId: string, entry: Entry, oldParentId: string) => void }).entryMoved;
	expect(entryMoved).toBeTypeOf('function');
	entryMoved?.call(app, 'personal-space', moved, 'old-parent');

	expect(oldList.dirty).toBe(true);
	expect(oldList.entries).toEqual([]);
	expect(newList.dirty).toBe(true);
	expect(root.dirty).toBe(true);
	expect(visited.dirty).toBe(true);
	expect(newList.entries).not.toContainEqual(moved);
});

it('drops an old in-flight list response and reloads the moved destination', async () => {
	const app = new CloudState();
	const list = app.list('files', 'personal-space', 'destination');
	app.activeListKey = list.key;
	api.getEntry.mockResolvedValue({
		entry: { id: 'destination', spaceId: 'personal-space', name: 'Destination', kind: EntryKind.FOLDER, revision: 1 }
	});
	let resolveOld!: (response: { entries: Entry[]; nextPageToken: string }) => void;
	api.listEntries.mockImplementationOnce(
		() => new Promise((resolve) => { resolveOld = resolve; })
	);
	api.listEntries.mockResolvedValueOnce({
		entries: [{ id: 'fresh', spaceId: 'personal-space', name: 'fresh.txt', kind: EntryKind.FILE, revision: 1 }],
		nextPageToken: ''
	});
	const pending = app.load(list);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	const moved = {
		id: 'moved-file',
		spaceId: 'personal-space',
		parentId: 'destination',
		name: 'file.txt',
		kind: EntryKind.FILE,
		revision: 2
	} as Entry;
	const entryMoved = (app as unknown as { entryMoved?: (spaceId: string, entry: Entry, oldParentId: string) => void }).entryMoved;
	expect(entryMoved).toBeTypeOf('function');
	entryMoved?.call(app, 'personal-space', moved, 'old-parent');
	resolveOld({
		entries: [{ id: 'stale', spaceId: 'personal-space', name: 'stale.txt', kind: EntryKind.FILE, revision: 1 } as Entry],
		nextPageToken: ''
	});
	await pending;
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(2);
	await expect.poll(() => list.entries[0]?.id).toBe('fresh');
	expect(list.entries.some((entry) => entry.id === 'stale')).toBe(false);
});

it('moves an entry into a selected folder using its current revision', async () => {
	const destination = { id: 'destination', spaceId: 'personal-space', name: 'Destination', kind: EntryKind.FOLDER, revision: 1 };
	const file = { id: 'file-1', spaceId: 'personal-space', name: 'report.txt', kind: EntryKind.FILE, sizeBytes: 3n, revision: 7 };
	api.listEntries.mockImplementation(async (request) => ({
		entries: request.parentId === 'destination' ? [] : [destination, file],
		nextPageToken: ''
	}));
	api.moveEntry.mockResolvedValueOnce({ entry: { ...file, parentId: 'destination', revision: 8 } });
	const screen = await render(StoragePage);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	await screen.getByRole('button', { name: 'Przenieś report.txt', exact: true }).click();
	await screen.getByRole('dialog').getByRole('button', { name: 'Otwórz folder Destination' }).click();
	await screen.getByRole('button', { name: 'Przenieś tutaj' }).click();
	await expect.poll(() => api.moveEntry).toHaveBeenCalledTimes(1);
	expect(api.moveEntry.mock.calls[0]?.[0]).toMatchObject({
		spaceId: 'personal-space',
		entryId: 'file-1',
		parentId: 'destination',
		expectedRevision: 7
	});
});

it('moves an entry to root without a parent id', async () => {
	const source = { id: 'source', spaceId: 'personal-space', name: 'Source', kind: EntryKind.FOLDER, revision: 1 };
	const file = { id: 'file-2', spaceId: 'personal-space', parentId: 'source', name: 'report.txt', kind: EntryKind.FILE, sizeBytes: 3n, revision: 4 };
	page.url = new URL('https://chmura.blokserwis.pl/main?folder=source');
	api.getEntry.mockResolvedValueOnce({ entry: source });
	api.listEntries.mockImplementation(async (request) => ({
		entries: request.parentId === 'source' ? [file] : [source],
		nextPageToken: ''
	}));
	api.moveEntry.mockResolvedValueOnce({ entry: { ...file, parentId: '', revision: 5 } });
	const screen = await render(StoragePage);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	await screen.getByRole('button', { name: 'Przenieś report.txt', exact: true }).click();
	await screen.getByRole('button', { name: 'Przenieś do korzenia' }).click();
	await expect.poll(() => api.moveEntry).toHaveBeenCalledTimes(1);
	expect(api.moveEntry.mock.calls[0]?.[0]).toMatchObject({
		spaceId: 'personal-space',
		entryId: 'file-2',
		expectedRevision: 4
	});
	expect(api.moveEntry.mock.calls[0]?.[0]?.parentId).toBeUndefined();
});

it('keeps the move dialog open and reports a destination name conflict', async () => {
	const destination = { id: 'destination', spaceId: 'personal-space', name: 'Destination', kind: EntryKind.FOLDER, revision: 1 };
	const file = { id: 'file-3', spaceId: 'personal-space', name: 'report.txt', kind: EntryKind.FILE, sizeBytes: 3n, revision: 2 };
	api.listEntries.mockResolvedValue({ entries: [destination, file], nextPageToken: '' });
	api.moveEntry.mockRejectedValueOnce(new ConnectError('ALREADY_EXISTS', Code.AlreadyExists));
	const screen = await render(StoragePage);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	await screen.getByRole('button', { name: 'Przenieś report.txt', exact: true }).click();
	await screen.getByRole('dialog').getByRole('button', { name: 'Otwórz folder Destination' }).click();
	await screen.getByRole('button', { name: 'Przenieś tutaj' }).click();
	await expect.element(screen.getByRole('alert').getByText('Element o tej nazwie już istnieje.')).toBeVisible();
	await expect.element(screen.getByRole('dialog')).toBeVisible();
});

it('canceling the move dialog does not call the move API', async () => {
	const file = { id: 'file-4', spaceId: 'personal-space', name: 'report.txt', kind: EntryKind.FILE, sizeBytes: 3n, revision: 1 };
	api.listEntries.mockResolvedValueOnce({ entries: [file], nextPageToken: '' });
	const screen = await render(StoragePage);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	await screen.getByRole('button', { name: 'Przenieś report.txt', exact: true }).click();
	await screen.getByRole('button', { name: 'Anuluj', exact: true }).click();
	expect(api.moveEntry).not.toHaveBeenCalled();
	await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
});

it('changes the sort from the catalog control and renders the creation date', async () => {
	const createdAt = { seconds: 1_740_787_200n, nanos: 0 };
	const file = {
		id: 'sorted-file',
		spaceId: 'personal-space',
		name: 'dated.txt',
		kind: EntryKind.FILE,
		sizeBytes: 3n,
		revision: 1,
		createdAt
	};
	api.listEntries.mockResolvedValue({ entries: [file], nextPageToken: 'next-page' });
	const screen = await render(StoragePage);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	const dateLabel = new Date(Number(createdAt.seconds) * 1000).toLocaleDateString('pl-PL');
	await expect.element(screen.getByRole('cell', { name: dateLabel })).toBeVisible();
	await screen.getByRole('combobox', { name: 'Sortowanie' }).selectOptions(['SIZE:DESC']);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(2);
	expect(api.listEntries.mock.calls[1]?.[0]).toMatchObject({
		sortBy: CatalogSortBy.SIZE,
		sortDirection: CatalogSortDirection.DESC,
		pageToken: ''
	});
});

it('selects only loaded rows and skips folders during bulk downloads', async () => {
	vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
	const folder = { id: 'folder-1', spaceId: 'personal-space', name: 'Reports', kind: EntryKind.FOLDER, revision: 1 };
	const first = { id: 'file-1', spaceId: 'personal-space', name: 'one.pdf', kind: EntryKind.FILE, revision: 1 };
	const second = { id: 'file-2', spaceId: 'personal-space', name: 'two.pdf', kind: EntryKind.FILE, revision: 1 };
	api.listEntries.mockResolvedValue({ entries: [folder, first, second], nextPageToken: '' });
	const screen = await render(StoragePage);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	await screen.getByRole('table').getByRole('checkbox', { name: 'Zaznacz wszystkie wczytane elementy' }).click();
	await expect.element(screen.getByRole('table').getByRole('checkbox', { name: 'Zaznacz wszystkie wczytane elementy' })).toBeChecked();
	await expect.element(screen.getByRole('toolbar', { name: 'Operacje dla zaznaczonych elementów' }).getByText('Zaznaczono: 3')).toBeVisible();
	await screen.getByRole('button', { name: 'Pobierz pliki' }).click();
	await expect.poll(() => api.getDownload).toHaveBeenCalledTimes(2);
	expect(api.getDownload.mock.calls.map(([request]) => request?.entryId)).toEqual(expect.arrayContaining(['file-1', 'file-2']));
	expect(api.getDownload.mock.calls.some(([request]) => request?.entryId === folder.id)).toBe(false);
});

it('keeps a singly selected file visibly checked and marks the main checkbox as partial', async () => {
	const files = [
		{ id: 'file-1', spaceId: 'personal-space', name: 'one.txt', kind: EntryKind.FILE, revision: 1 },
		{ id: 'file-2', spaceId: 'personal-space', name: 'two.txt', kind: EntryKind.FILE, revision: 1 }
	];
	api.listEntries.mockResolvedValue({ entries: files, nextPageToken: '' });
	const screen = await render(StoragePage);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	const fileCheckbox = screen.getByRole('row', { name: /one.txt/ }).getByRole('checkbox', { name: 'Zaznacz one.txt' });
	const mainCheckbox = screen.getByRole('table').getByRole('checkbox', { name: 'Zaznacz wszystkie wczytane elementy' });
	await fileCheckbox.click();
	await expect.element(fileCheckbox).toBeChecked();
	await expect.element(mainCheckbox).toHaveProperty('indeterminate', true);
	await expect.element(screen.getByRole('row', { name: /one.txt/ })).toHaveAttribute('aria-selected', 'true');
	await expect.element(screen.getByRole('row', { name: /two.txt/ })).toHaveAttribute('aria-selected', 'false');
	await mainCheckbox.click();
	await expect.element(screen.getByRole('row', { name: /two.txt/ }).getByRole('checkbox', { name: 'Zaznacz two.txt' })).toBeChecked();
	await expect.element(mainCheckbox).toBeChecked();
	await mainCheckbox.click();
	await expect.element(fileCheckbox).not.toBeChecked();
	await expect.element(mainCheckbox).not.toBeChecked();
});

it('sends one bulk trash request and keeps the failed item selected', async () => {
	const files = Array.from({ length: 5 }, (_, index) => ({
		id: `file-${index + 1}`,
		spaceId: 'personal-space',
		name: `file-${index + 1}.txt`,
		kind: EntryKind.FILE,
		revision: 1
	}));
	api.listEntries.mockResolvedValue({ entries: files, nextPageToken: '' });
	api.bulkTrashEntries.mockImplementation(async (request) => ({ results: request.items.map((item: { entryId: string }) => ({ entryId: item.entryId, success: item.entryId !== 'file-5', error: item.entryId === 'file-5' ? 'REVISION_CONFLICT' : '' })) }));
	const screen = await render(StoragePage);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	await screen.getByRole('table').getByRole('checkbox', { name: 'Zaznacz wszystkie wczytane elementy' }).click();
	await screen.getByRole('button', { name: 'Do kosza', exact: true }).click();
	await screen.getByRole('dialog').getByRole('button', { name: 'Przenieś do kosza', exact: true }).click();
	await expect.poll(() => api.bulkTrashEntries).toHaveBeenCalledTimes(1);
	expect(api.bulkTrashEntries.mock.calls[0][0].items).toHaveLength(5);
	await expect.element(screen.getByRole('dialog').getByText(/nie udało się przenieść 1/i)).toBeVisible();
	await expect.element(screen.getByRole('toolbar').getByText('Zaznaczono: 1')).toBeVisible();
	await expect.element(screen.getByRole('row', { name: /file-5.txt/ }).getByRole('checkbox', { name: 'Zaznacz file-5.txt' })).toBeChecked();
});

it('opens supported images in a preview dialog with a separate download action', async () => {
	const image = {
		id: 'image-1',
		spaceId: 'personal-space',
		name: 'photo.png',
		kind: EntryKind.FILE,
		sizeBytes: 3n,
		revision: 1
	};
	api.listEntries.mockResolvedValueOnce({ entries: [image], nextPageToken: '' });
	api.getPreview.mockResolvedValueOnce({
		url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6xkAAAAASUVORK5CYII=',
		expiresAt: { seconds: BigInt(Math.floor((Date.now() + 300_000) / 1000)), nanos: 0 },
		contentType: 'image/png',
		mediaKind: 1
	});
	const screen = await render(StoragePage);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	await screen.getByRole('row', { name: /Podgląd photo\.png/ }).getByRole('button', { name: 'Podgląd photo.png' }).click();
	const dialog = screen.getByRole('dialog', { name: 'photo.png' });
	await expect.element(dialog.getByRole('img', { name: 'photo.png' })).toBeVisible();
	expect(api.getPreview.mock.calls[0]?.[0]).toMatchObject({
		spaceId: 'personal-space',
		entryId: 'image-1'
	});
	await screen.getByRole('button', { name: 'Zamknij podgląd' }).click();
	await expect.element(dialog).not.toBeInTheDocument();
});

it('does not show media when a preview request finishes after the dialog closes', async () => {
	const image = {
		id: 'late-image',
		spaceId: 'personal-space',
		name: 'late.png',
		kind: EntryKind.FILE,
		sizeBytes: 3n,
		revision: 1
	};
	api.listEntries.mockResolvedValueOnce({ entries: [image], nextPageToken: '' });
	let finishPreview!: (result: object) => void;
	api.getPreview.mockImplementationOnce(
		() => new Promise((resolve) => { finishPreview = resolve; })
	);
	const screen = await render(StoragePage);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	await screen.getByRole('row', { name: /Podgląd late\.png/ }).getByRole('button', { name: 'Podgląd late.png' }).click();
	const dialog = screen.getByRole('dialog', { name: 'late.png' });
	await expect.element(dialog.getByRole('status')).toBeVisible();
	await screen.getByRole('button', { name: 'Zamknij podgląd' }).click();
	finishPreview({
		url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6xkAAAAASUVORK5CYII=',
		expiresAt: { seconds: BigInt(Math.floor((Date.now() + 300_000) / 1000)), nanos: 0 },
		contentType: 'image/png',
		mediaKind: 1
	});
	await expect.element(dialog).not.toBeInTheDocument();
	expect(document.querySelector('img[alt="late.png"]')).toBeNull();
});

it('creates and lists a custom public link from the file action', async () => {
	const file = {
		id: 'share-file',
		spaceId: 'personal-space',
		name: 'shared.png',
		kind: EntryKind.FILE,
		sizeBytes: 3n,
		revision: 1
	};
	api.listEntries.mockResolvedValueOnce({ entries: [file], nextPageToken: '' });
	api.createShare.mockRejectedValueOnce(new Error('temporary network issue'));
	api.createShare.mockResolvedValueOnce({
		share: {
			id: 'share-id',
			address: 'my-picture',
			createdAt: { seconds: BigInt(Math.floor(Date.now() / 1000)), nanos: 0 },
			expiresAt: undefined,
			revokedAt: undefined,
			label: 'Dla klienta X',
			hasPassword: true,
			maxDownloads: 2n,
			downloadCount: 0n,
			viewCount: 0n,
			revision: 1
		}
	});
	api.updateShare.mockResolvedValueOnce({
		share: {
			id: 'share-id',
			address: 'my-picture',
			createdAt: { seconds: BigInt(Math.floor(Date.now() / 1000)), nanos: 0 },
			expiresAt: undefined,
			revokedAt: undefined,
			label: 'Dla nowego klienta',
			hasPassword: true,
			maxDownloads: 2n,
			downloadCount: 0n,
			viewCount: 0n,
			revision: 2
		}
	});
	const screen = await render(StoragePage);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	await screen.getByRole('row', { name: /shared\.png/ }).getByRole('button', { name: 'Udostępnij shared.png' }).click();
	const dialog = screen.getByRole('dialog', { name: 'Udostępnij plik' });
	await expect.poll(() => api.listShares).toHaveBeenCalledTimes(1);
	await dialog.getByLabelText(/Własny slug/).fill('my-picture');
	await dialog.getByLabelText(/Etykieta/).fill('Dla klienta X');
	await dialog.getByLabelText('Hasło').fill('secret');
	await dialog.getByLabelText('Limit pobrań').fill('2');
	await dialog.getByRole('button', { name: 'Utwórz link' }).click();
	await expect.element(dialog.getByRole('alert')).toBeVisible();
	await expect.poll(() => api.createShare).toHaveBeenCalledTimes(1);
	const firstRequestId = api.createShare.mock.calls[0]?.[0]?.requestId;
	await dialog.getByRole('button', { name: 'Utwórz link' }).click();
	await expect.poll(() => api.createShare).toHaveBeenCalledTimes(2);
	expect(api.createShare.mock.calls[0]?.[0]).toMatchObject({
		spaceId: 'personal-space',
		entryId: 'share-file',
		slug: 'my-picture',
		label: 'Dla klienta X',
		password: 'secret',
		maxDownloads: 2n,
		requestId: expect.any(String)
	});
	expect(api.createShare.mock.calls[1]?.[0]?.requestId).toBe(firstRequestId);
	await expect.element(dialog.getByText(/\/s\/my-picture$/)).toBeVisible();
	const shareRow = dialog.getByRole('listitem');
	await shareRow.getByRole('button', { name: 'Edytuj' }).click();
	await shareRow.getByLabelText('Etykieta').fill('Dla nowego klienta');
	await shareRow.getByRole('button', { name: 'Zapisz ustawienia' }).click();
	await expect.poll(() => api.updateShare).toHaveBeenCalledTimes(1);
	expect(api.updateShare.mock.calls[0]?.[0]).toMatchObject({
		spaceId: 'personal-space',
		shareId: 'share-id',
		expectedRevision: 1,
		updateMask: { paths: ['label', 'expiresAt', 'maxDownloads'] },
		label: 'Dla nowego klienta',
		maxDownloads: 2n
	});
	await expect.element(shareRow.getByText('Dla nowego klienta')).toBeVisible();
	await expect.element(shareRow.getByText(/\/s\/my-picture$/)).toBeVisible();
});

it('waits for the route folder to resolve before creating an upload in that folder', async () => {
	let resolveFolder!: (response: { entry: object }) => void;
	api.getEntry.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				resolveFolder = resolve;
			})
	);
	api.listEntries.mockResolvedValue({ entries: [], nextPageToken: '' });
	page.url = new URL('https://chmura.blokserwis.pl/main?folder=target-folder');
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await expect.poll(() => api.getEntry).toHaveBeenCalled();
	const input = screen.getByLabelText('Wybierz pliki do przesłania');
	expect(input.element()).toBeDisabled();
	await input.upload(new File(['hello'], 'raport.pdf'));
	expect(api.createUpload).not.toHaveBeenCalled();

	resolveFolder({
		entry: {
			id: 'target-folder',
			spaceId: 'personal-space',
			parentId: '',
			name: 'Dokumenty',
			kind: EntryKind.FOLDER
		}
	});
	await expect.poll(() => input.element().hasAttribute('disabled')).toBe(false);
	await input.upload(new File(['hello'], 'raport.pdf'));
	await expect.poll(() => api.createUpload).toHaveBeenCalledTimes(1);
	expect(api.createUpload.mock.calls[0]?.[0]?.parentId).toBe('target-folder');
});

it('uses the account upload limit and blocks file selection when it cannot be loaded', async () => {
	api.getUploadLimits.mockResolvedValue({ maxUploadBytes: 1n, canManage: false });
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await expect.poll(() => api.getUploadLimits).toHaveBeenCalledTimes(1);
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload(new File(['hello'], 'raport.pdf'));
	await expect.element(screen.getByText(/maksymalnie 1 B/)).toBeVisible();
	expect(api.createUpload).not.toHaveBeenCalled();
});

it('accepts a zero-byte backend limit, allows empty files and rejects nonempty files', async () => {
	api.getUploadLimits.mockResolvedValue({ maxUploadBytes: 0n, canManage: true });
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await expect.poll(() => api.getUploadLimits).toHaveBeenCalledTimes(1);
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload(new File(['hello'], 'nonempty.txt'));
	await expect.element(screen.getByText(/maksymalnie 0 B/)).toBeVisible();
	expect(api.createUpload).not.toHaveBeenCalled();
	await screen.getByLabelText('Wybierz pliki do przesłania').upload(new File([], 'empty.txt'));
	await expect.poll(() => api.createUpload).toHaveBeenCalledTimes(1);
	expect(api.createUpload.mock.calls[0]?.[0]).toMatchObject({ sizeBytes: 0n });
	await expect.element(screen.getByText('Przesłano', { exact: true })).toBeVisible();
});

it('disables upload and offers retry when the public upload limit cannot be loaded', async () => {
	api.getUploadLimits.mockRejectedValueOnce(new Error('API unavailable'));
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await expect.element(screen.getByRole('alert').getByText(/API unavailable/)).toBeVisible();
	expect(screen.getByLabelText('Wybierz pliki do przesłania').element()).toBeDisabled();
	await screen.getByRole('button', { name: 'Ponów próbę' }).click();
	await expect.poll(() => api.getUploadLimits).toHaveBeenCalledTimes(2);
});

it('loads the selected private or shared trash after switching the tabs', async () => {
	const screen = await render(StoragePage, { props: { mode: 'trash' } });

	await expect.poll(() => api.listTrash.mock.calls.at(-1)?.[0]?.spaceId).toBe('main-space');
	await screen.getByRole('button', { name: 'Pliki prywatne' }).click();
	await expect.poll(() => api.listTrash.mock.calls.at(-1)?.[0]?.spaceId).toBe('personal-space');
	await expect
		.element(screen.getByRole('button', { name: 'Pliki prywatne' }))
		.toHaveAttribute('aria-pressed', 'true');
	expect(api.listTrash).toHaveBeenCalledTimes(2);
});

it('lets the user select RustFS and shows the returned session location in status and file list', async () => {
	api.listEntries.mockResolvedValue({
		entries: [
			{
				id: 'file-rustfs',
				spaceId: 'personal-space',
				name: 'raport.pdf',
				kind: EntryKind.FILE,
				sizeBytes: 1024n,
				revision: 1,
				storageLocation: StorageLocation.RUSTFS
			}
		],
		nextPageToken: ''
	});
	api.createUpload.mockResolvedValue({
		session: { id: 'upload-1', state: UploadState.OPEN, storageLocation: StorageLocation.R2 },
		target: { url: 'https://storage.example/signed', headers: {} }
	});
	const app = new CloudState();
	const screen = await render(StoragePage, { props: { spaceKind: 'private', app } });
	app.setDefaultUploadMode(UploadMode.RUSTFS);
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload(new File(['hello'], 'raport.pdf'));

	await expect
		.poll(() => api.createUpload.mock.calls.at(-1)?.[0]?.uploadMode)
		.toBe(UploadMode.RUSTFS);
	await expect.element(screen.getByText('Miejsce: R2', { exact: true })).toBeVisible();
	await expect
		.element(screen.getByRole('table').getByText('RustFS', { exact: true }))
		.toBeVisible();
	await expect.element(screen.getByText('RustFS', { exact: true }).nth(1)).toBeInTheDocument();
	await expect
		.element(screen.getByRole('table').getByText('raport.pdf', { exact: true }))
		.toBeVisible();
	expect(api.uploadToTarget).toHaveBeenCalledTimes(1);
});

it('keeps the selected upload mode for the active transfer if the preference changes', async () => {
	let finishPut!: () => void;
	api.uploadToTarget.mockImplementation(
		() =>
			new Promise<void>((resolve) => {
				finishPut = resolve;
			})
	);
	const app = new CloudState();
	const screen = await render(StoragePage, { props: { spaceKind: 'private', app } });
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload(new File(['hello'], 'raport.pdf'));
	await expect.poll(() => api.uploadToTarget).toHaveBeenCalledTimes(1);
	app.setDefaultUploadMode(UploadMode.RUSTFS);
	expect(api.createUpload.mock.calls.at(-1)?.[0]?.uploadMode).toBe(UploadMode.AUTO);
	finishPut();
	await expect.poll(() => api.completeUpload).toHaveBeenCalledTimes(1);
});

it('does not retry a failed RustFS PUT through another storage location', async () => {
	api.uploadToTarget.mockRejectedValue(new Error('Przesyłanie pliku nie powiodło się (HTTP 403).'));
	const app = new CloudState();
	const screen = await render(StoragePage, { props: { spaceKind: 'private', app } });
	app.setDefaultUploadMode(UploadMode.RUSTFS);
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload(new File(['hello'], 'raport.pdf'));
	await expect
		.element(screen.getByText('Przesyłanie pliku nie powiodło się (HTTP 403).'))
		.toBeVisible();
	expect(api.createUpload).toHaveBeenCalledTimes(1);
	expect(api.createUpload.mock.calls[0]?.[0]?.uploadMode).toBe(UploadMode.RUSTFS);
});

it.each([
	[
		'STORAGE_UPLOADS_DISABLED',
		'Wybrany tryb przesyłania nie jest obecnie dostępny dla tego konta. Wybierz R2 dla nowego przesyłania.',
		Code.Unavailable
	],
	[
		'UPLOADS_PAUSED',
		'Przesyłanie plików jest tymczasowo wstrzymane. Spróbuj ponownie później.',
		Code.Unavailable
	],
	[
		'STORAGE_CAPACITY_EXCEEDED',
		'Brak dostępnego miejsca w wybranym magazynie. Zwiększ limit lub wybierz magazyn z wolną przestrzenią.',
		Code.ResourceExhausted
	],
	[
		'STORAGE_MEASUREMENT_UNAVAILABLE',
		'Nie można teraz potwierdzić dostępnej przestrzeni. Przesyłanie nie zostało rozpoczęte; spróbuj ponownie później.',
		Code.Unavailable
	]
])('shows a clear message for %s', async (code, message, grpcCode) => {
	api.createUpload.mockRejectedValue(new ConnectError(code, grpcCode));
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload(new File(['hello'], 'raport.pdf'));
	await expect.element(screen.getByText(message, { exact: true })).toBeVisible();
});

it.each([
	{ spaceKind: 'private' as const, spaceId: 'personal-space' },
	{ spaceKind: 'shared' as const, spaceId: 'main-space' }
])(
	'shows a visible confirmation before moving a file to trash in $spaceId',
	async ({ spaceKind, spaceId }) => {
		api.listEntries.mockResolvedValue({
			entries: [
				{
					id: 'file-1',
					spaceId,
					name: 'raport.pdf',
					kind: EntryKind.FILE,
					sizeBytes: 1024n,
					revision: 3
				}
			],
			nextPageToken: ''
		});
		const screen = await render(StoragePage, { props: { spaceKind } });

		await screen.getByRole('button', { name: 'Przenieś raport.pdf do kosza' }).click();
		expect(screen.getByRole('alertdialog')).toBeTruthy();
		expect(api.trashEntry).not.toHaveBeenCalled();

		await screen.getByRole('button', { name: 'Przenieś do kosza' }).click();
		await expect.poll(() => api.trashEntry.mock.calls.at(-1)?.[0]?.spaceId).toBe(spaceId);
		expect(api.trashEntry.mock.calls.at(-1)?.[0]).toMatchObject({
			entryId: 'file-1',
			expectedRevision: 3
		});
	}
);

it('sends Auto and shows the concrete location chosen by the backend', async () => {
	const app = new CloudState();
	const screen = await render(StoragePage, { props: { spaceKind: 'private', app } });
	app.setDefaultUploadMode(UploadMode.AUTO);
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload(new File(['hello'], 'auto.pdf'));
	await expect.poll(() => api.createUpload.mock.calls.at(-1)?.[0]?.uploadMode).toBe(3);
	await expect.element(screen.getByText('Miejsce: RustFS', { exact: true })).toBeVisible();
	expect(api.uploadToTarget).toHaveBeenCalledTimes(1);
});

it('defaults new operations to Auto after stage E acceptance', async () => {
	const app = new CloudState();
	const screen = await render(StoragePage, { props: { spaceKind: 'private', app } });
	expect(app.defaultUploadMode).toBe(UploadMode.AUTO);
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload(new File(['hello'], 'default-auto.pdf'));
	await expect
		.poll(() => api.createUpload.mock.calls.at(-1)?.[0]?.uploadMode)
		.toBe(UploadMode.AUTO);
});

function fallbackResponse() {
	return {
		session: {
			id: 'upload-1',
			attemptId: 'attempt-2',
			attemptNumber: 2,
			fallbackAllowed: false,
			state: UploadState.OPEN,
			storageLocation: StorageLocation.R2
		},
		target: { url: 'https://r2.example/retry', headers: {} }
	};
}

it('restarts the same file in R2 after Auto PUT 503, resets progress and ignores old callbacks', async () => {
	let finishRetry!: () => void;
	api.uploadToTarget.mockRejectedValueOnce(new UploadTargetError(503)).mockImplementationOnce(
		() =>
			new Promise<void>((resolve) => {
				finishRetry = resolve;
			})
	);
	api.retryUpload.mockResolvedValue(fallbackResponse());
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload(new File(['hello'], 'retry.pdf'));
	await expect.element(screen.getByText('Ponawiam w R2', { exact: true })).toBeVisible();
	expect(api.createUpload.mock.calls[0][0].supportsAttempts).toBe(true);
	expect(api.retryUpload.mock.calls[0][0]).toMatchObject({
		uploadId: 'upload-1',
		failedAttemptId: 'attempt-1',
		failureKind: UploadFailureKind.SERVER
	});
	expect(api.uploadToTarget.mock.calls[1][0]).toBe(api.uploadToTarget.mock.calls[0][0]);
	expect(screen.getByRole('progressbar').element().getAttribute('aria-valuenow')).toBe('0');
	api.uploadToTarget.mock.calls[0][3].onProgress(5, 5);
	await expect.element(screen.getByText('Ponawiam w R2', { exact: true })).toBeVisible();
	expect(screen.getByRole('progressbar').element().getAttribute('aria-valuenow')).toBe('0');
	finishRetry();
	await expect.element(screen.getByText('Przesłano', { exact: true })).toBeVisible();
	expect(api.completeUpload.mock.calls[0][0]).toMatchObject({
		uploadId: 'upload-1',
		attemptId: 'attempt-2'
	});
});

it.each([400, 403, 409, 412])('does not consume fallback for PUT HTTP %s', async (status) => {
	api.uploadToTarget.mockRejectedValue(new UploadTargetError(status));
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await screen.getByLabelText('Wybierz pliki do przesłania').upload(new File(['x'], 'failed.pdf'));
	await expect.element(screen.getByText(/Przesyłanie pliku nie powiodło się/)).toBeVisible();
	expect(api.retryUpload).not.toHaveBeenCalled();
});

it('accepts a completed response from Retry without sending the file again', async () => {
	api.uploadToTarget.mockRejectedValueOnce(new UploadTargetError(503));
	api.retryUpload.mockResolvedValue({
		session: { ...fallbackResponse().session, state: UploadState.COMPLETED },
		entry: { id: 'entry-1' }
	});
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload(new File(['x'], 'completed.pdf'));
	await expect.element(screen.getByText('Przesłano', { exact: true })).toBeVisible();
	expect(api.uploadToTarget).toHaveBeenCalledTimes(1);
	expect(api.completeUpload).not.toHaveBeenCalled();
});

it('recovers a lost completion response using GetUpload and finalizes the same attempt', async () => {
	api.completeUpload.mockRejectedValueOnce(new Error('response lost')).mockResolvedValueOnce({});
	api.getUpload.mockResolvedValue({
		session: { id: 'upload-1', attemptId: 'attempt-1', state: UploadState.OPEN }
	});
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload(new File(['x'], 'finalize.pdf'));
	await expect.element(screen.getByText('Przesłano', { exact: true })).toBeVisible();
	expect(api.getUpload.mock.calls[0][0].uploadId).toBe('upload-1');
	expect(api.completeUpload).toHaveBeenCalledTimes(2);
	expect(api.completeUpload.mock.calls[1][0].attemptId).toBe('attempt-1');
	expect(api.retryUpload).not.toHaveBeenCalled();
});

it('cancels the logical upload and active second transport', async () => {
	api.uploadToTarget.mockRejectedValueOnce(new UploadTargetError(503)).mockImplementationOnce(
		(_file, _url, _headers, options) =>
			new Promise((_resolve, reject) => {
				options.signal.addEventListener('abort', () =>
					reject(new DOMException('Cancelled', 'AbortError'))
				);
			})
	);
	api.retryUpload.mockResolvedValue(fallbackResponse());
	api.cancelUpload.mockResolvedValue({});
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await screen.getByLabelText('Wybierz pliki do przesłania').upload(new File(['x'], 'cancel.pdf'));
	await expect.element(screen.getByText('Ponawiam w R2', { exact: true })).toBeVisible();
	await screen.getByRole('button', { name: 'Anuluj', exact: true }).click();
	await expect.element(screen.getByText('Anulowano', { exact: true })).toBeVisible();
	expect(api.uploadToTarget.mock.calls[1][3].signal.aborted).toBe(true);
	expect(api.cancelUpload.mock.calls[0][0].uploadId).toBe('upload-1');
	expect(api.completeUpload).not.toHaveBeenCalled();
});

it('uses fallback for a transport failure only once', async () => {
	api.uploadToTarget.mockRejectedValue(new UploadTransportError());
	api.retryUpload.mockResolvedValue(fallbackResponse());
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload(new File(['x'], 'transport.pdf'));
	await expect
		.element(screen.getByText('Błąd sieci podczas wysyłania pliku.', { exact: true }))
		.toBeVisible();
	expect(api.retryUpload).toHaveBeenCalledTimes(1);
	expect(api.retryUpload.mock.calls[0][0].failureKind).toBe(UploadFailureKind.TRANSPORT);
	expect(api.uploadToTarget).toHaveBeenCalledTimes(2);
	expect(api.completeUpload).not.toHaveBeenCalled();
});

it('keeps the active transfer and queued destination when the page is replaced', async () => {
	let finish!: () => void;
	api.uploadToTarget.mockImplementationOnce(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			})
	);
	const app = new CloudState();
	const screen = await render(StoragePage, { props: { spaceKind: 'private', app } });
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload([new File(['x'], 'first.txt'), new File(['y'], 'second.txt')]);
	await expect.poll(() => api.uploadToTarget).toHaveBeenCalledTimes(1);
	const signal = api.uploadToTarget.mock.calls[0][3].signal as AbortSignal;
	await screen.rerender({ spaceKind: 'shared', app });
	expect(signal.aborted).toBe(false);
	await expect.element(screen.getByText('first.txt', { exact: true })).toBeVisible();
	finish();
	await expect.poll(() => app.transfers.pendingCount).toBe(0);
	expect(api.createUpload.mock.calls.map((call) => call[0].spaceId)).toEqual([
		'personal-space',
		'personal-space'
	]);
	expect(api.getMe).toHaveBeenCalledTimes(1);
});

it('does not create another target when connectivity is lost during the first PUT', async () => {
	let online = true;
	vi.spyOn(navigator, 'onLine', 'get').mockImplementation(() => online);
	api.uploadToTarget.mockImplementationOnce(async () => {
		online = false;
		throw new UploadTransportError();
	});
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await screen.getByLabelText('Wybierz pliki do przesłania').upload(new File(['x'], 'offline.pdf'));
	await expect.element(screen.getByText(/Brak połączenia z siecią/)).toBeVisible();
	expect(api.retryUpload).not.toHaveBeenCalled();
	expect(api.uploadToTarget).toHaveBeenCalledTimes(1);
});

it('does not reserve any upload while the browser is offline', async () => {
	vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await screen.getByLabelText('Wybierz pliki do przesłania').upload(new File(['x'], 'offline.pdf'));
	await expect.element(screen.getByText(/Brak połączenia z siecią/)).toBeVisible();
	expect(api.createUpload).not.toHaveBeenCalled();
});

it('keeps manual transfers from using fallback even after a server failure', async () => {
	api.uploadToTarget.mockRejectedValueOnce(new UploadTargetError(503));
	const app = new CloudState();
	const screen = await render(StoragePage, { props: { spaceKind: 'private', app } });
	app.setDefaultUploadMode(UploadMode.R2);
	await screen.getByLabelText('Wybierz pliki do przesłania').upload(new File(['x'], 'manual.pdf'));
	await expect.element(screen.getByText(/HTTP 503/)).toBeVisible();
	expect(api.retryUpload).not.toHaveBeenCalled();
});

it('does not retry finalization or transfer when GetUpload confirms completion', async () => {
	api.completeUpload.mockRejectedValueOnce(new Error('response lost'));
	api.getUpload.mockResolvedValue({
		session: { id: 'upload-1', attemptId: 'attempt-1', state: UploadState.COMPLETED }
	});
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await screen
		.getByLabelText('Wybierz pliki do przesłania')
		.upload(new File(['x'], 'already-done.pdf'));
	await expect.element(screen.getByText('Przesłano', { exact: true })).toBeVisible();
	expect(api.completeUpload).toHaveBeenCalledTimes(1);
	expect(api.uploadToTarget).toHaveBeenCalledTimes(1);
	expect(api.retryUpload).not.toHaveBeenCalled();
});

it('cancels immediately while Retry RPC is pending and ignores its later target', async () => {
	let finishRetry!: (result: ReturnType<typeof fallbackResponse>) => void;
	api.uploadToTarget.mockRejectedValueOnce(new UploadTargetError(503));
	api.retryUpload.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finishRetry = resolve;
			})
	);
	api.cancelUpload.mockResolvedValue({});
	const screen = await render(StoragePage, { props: { spaceKind: 'private' } });
	await screen.getByLabelText('Wybierz pliki do przesłania').upload(new File(['x'], 'pending.pdf'));
	await expect.poll(() => api.retryUpload).toHaveBeenCalledTimes(1);
	await screen.getByRole('button', { name: 'Anuluj', exact: true }).click();
	await expect.poll(() => api.cancelUpload).toHaveBeenCalledTimes(1);
	expect(api.cancelUpload.mock.calls[0][0].uploadId).toBe('upload-1');
	expect(api.retryUpload.mock.calls[0][1]?.signal?.aborted).toBe(true);
	finishRetry(fallbackResponse());
	await expect.element(screen.getByText('Anulowano', { exact: true })).toBeVisible();
	expect(api.uploadToTarget).toHaveBeenCalledTimes(1);
	expect(api.completeUpload).not.toHaveBeenCalled();
});

it('does not refetch the catalogue for dialog and upload-menu interactions', async () => {
	const app = new CloudState();
	const screen = await render(StoragePage, { props: { spaceKind: 'private', app } });
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	await screen.getByRole('button', { name: 'Nowy folder' }).click();
	await expect.element(screen.getByRole('dialog')).toBeVisible();
	await screen.getByRole('button', { name: 'Anuluj', exact: true }).click();
	app.setDefaultUploadMode(UploadMode.R2);
	expect(api.listEntries).toHaveBeenCalledTimes(1);
	expect(api.getMe).toHaveBeenCalledTimes(1);
});
it('uses the preference from settings for each new batch', async () => {
	const app = new CloudState();
	app.setDefaultUploadMode(UploadMode.R2);
	const screen = await render(StoragePage, { props: { spaceKind: 'private', app } });
	app.setDefaultUploadMode(UploadMode.RUSTFS);
	await screen.getByLabelText('Wybierz pliki do przesłania').upload(new File(['x'], 'override'));
	await expect.poll(() => app.transfers.pendingCount).toBe(0);
	app.setDefaultUploadMode(UploadMode.R2);
	await screen.getByLabelText('Wybierz pliki do przesłania').upload(new File(['x'], 'default'));
	await expect.poll(() => api.createUpload).toHaveBeenCalledTimes(2);
	expect(api.createUpload.mock.calls.map((call) => call[0].uploadMode)).toEqual([
		UploadMode.RUSTFS,
		UploadMode.R2
	]);
});

it('keeps configuration and decorative content out of the files view', async () => {
	const screen = await render(StoragePage);
	await expect.poll(() => api.listEntries).toHaveBeenCalledTimes(1);
	expect(screen.getByRole('combobox', { name: 'Sortowanie' }).elements()).toHaveLength(1);
	expect(screen.getByText('Zawartość', { exact: true }).elements()).toHaveLength(0);
	expect(screen.getByText('Maksymalny rozmiar pliku: 100 MB.').elements()).toHaveLength(0);
	expect(screen.getByRole('button', { name: /Przeciągnij pliki na stronę/ }).elements()).toHaveLength(0);
	expect(screen.getByText('Bezpieczne przechowywanie plików').elements()).toHaveLength(0);
});

it('reconciles a cached file removed by another client when its operation is rejected', async () => {
	api.listEntries.mockResolvedValueOnce({
		entries: [
			{
				id: 'gone',
				spaceId: 'personal-space',
				name: 'gone.txt',
				kind: EntryKind.FILE,
				sizeBytes: 1n,
				revision: 3
			}
		],
		nextPageToken: ''
	});
	api.trashEntry.mockRejectedValueOnce(new ConnectError('NOT_FOUND', Code.NotFound));
	const screen = await render(StoragePage);
	await screen.getByRole('button', { name: 'Przenieś gone.txt do kosza' }).click();
	await screen.getByRole('button', { name: 'Przenieś do kosza', exact: true }).click();
	await expect.element(screen.getByRole('alertdialog')).not.toBeInTheDocument();
	await expect.element(screen.getByRole('table').getByText('Folder jest pusty')).toBeVisible();
	expect(api.trashEntry.mock.calls[0][0]).toMatchObject({ entryId: 'gone', expectedRevision: 3 });
	expect(api.listEntries).toHaveBeenCalledTimes(2);
});

it('finishes stale-entry reconciliation after a pending refresh even when the origin view was left', async () => {
	const app = new CloudState();
	const entry = {
		id: 'gone',
		spaceId: 'personal-space',
		name: 'gone.txt',
		kind: EntryKind.FILE,
		sizeBytes: 1n,
		revision: 3
	};
	api.listEntries.mockResolvedValueOnce({ entries: [entry], nextPageToken: '' });
	const screen = await render(StoragePage, { props: { app } });
	await expect.poll(() => app.peekList('files', 'personal-space', '')?.initialized).toBe(true);
	await app.load(app.list('files', 'main-space', ''));
	const root = app.list('files', 'personal-space', '');
	let finishRefresh!: (value: object) => void;
	api.listEntries.mockImplementationOnce(
		() =>
			new Promise((resolve) => {
				finishRefresh = resolve;
			})
	);
	const refresh = app.load(root, { force: true });
	let rejectMutation!: (error: unknown) => void;
	api.trashEntry.mockImplementationOnce(
		() =>
			new Promise((_resolve, reject) => {
				rejectMutation = reject;
			})
	);
	await screen.getByRole('button', { name: 'Przenieś gone.txt do kosza' }).click();
	await screen.getByRole('button', { name: 'Przenieś do kosza', exact: true }).click();
	await expect.poll(() => api.trashEntry).toHaveBeenCalledTimes(1);
	await screen.rerender({ spaceKind: 'shared' });
	await expect.poll(() => app.activeList).toMatchObject({ mode: 'files', spaceId: 'main-space', parentId: '' });
	rejectMutation(new ConnectError('NOT_FOUND', Code.NotFound));
	await expect.poll(() => root.version).toBe(1);
	finishRefresh({ entries: [entry], nextPageToken: '' });
	await refresh;
	await expect.poll(() => root.dirty).toBe(false);
	expect(root.entries).toHaveLength(0);
});
