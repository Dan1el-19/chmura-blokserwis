<script lang="ts">
	import { onDestroy, onMount, untrack } from 'svelte';
	import { SvelteMap, SvelteSet } from 'svelte/reactivity';
	import { toast } from 'svelte-sonner';
	import { getCloudState, type CatalogSort, type CatalogSortBy, type CatalogSortDirection } from '#lib/cloud-state.svelte.js';
	import { storageErrorMessage as errorMessage } from '#lib/storage-error.js';
	import AppDialog from './AppDialog.svelte';
	import MoveEntryDialog from './MoveEntryDialog.svelte';
	import FilePreviewDialog from './FilePreviewDialog.svelte';
	import ShareLinksDialog from './ShareLinksDialog.svelte';
	import ActionMenu from './ui/ActionMenu.svelte';
	import EntryDetailsDialog from './storage/EntryDetailsDialog.svelte';
	import { mediaKindForFilename } from '#lib/media-preview.js';
	import { nextAvailableUploadName, uploadNameKey } from '#lib/upload-conflict.js';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { AppRouteWithQuery } from '#lib/routes.js';
	import { page } from '$app/state';
	import { Code, ConnectError } from '@connectrpc/connect';
	import { create } from '@bufbuild/protobuf';
	import { timestampDate } from '@bufbuild/protobuf/wkt';
	import { catalog, trash } from '#lib/api.js';
	import {
		ArrowUp,
		ArrowClockwise,
		CaretRight,
		CloudArrowUp,
		DownloadSimple,
		File as FileIcon,
		FileAudio,
		FileImage,
		FileVideo,
		Folder,
		FolderPlus,
		MagnifyingGlass,
		SpinnerGap,
		Trash
	} from 'phosphor-svelte';
	import {
		CatalogFileType,
		BulkTrashEntriesRequestSchema,
		BulkDeletePermanentlyRequestSchema,
		BulkRestoreEntriesRequestSchema,
		CatalogSortBy as CatalogSortByProto,
		CatalogSortDirection as CatalogSortDirectionProto,
		SearchEntriesRequestSchema,
		ListEntriesRequestSchema,
		CreateFolderRequestSchema,
		DeletePermanentlyRequestSchema,
		EntryKind,
		GetDownloadRequestSchema,
		MoveEntryRequestSchema,
		RenameEntryRequestSchema,
		RestoreEntryRequestSchema,
		SpaceKind,
		StorageLocation,
		TrashEntryRequestSchema,
		type CreateFolderRequest,
		type Entry,
		type SearchEntryResult,
		type TrashItem
	} from '#lib/gen/unisourcecfl/catalog/v1/catalog_pb.js';

	type MainView = 'files' | 'trash';
	let {
		spaceKind = 'shared',
		mode = 'files'
	}: {
		spaceKind?: 'private' | 'shared';
		mode?: MainView;
	} = $props();

	const app = getCloudState();
	const accountReady = $derived(app.accountReady);
	const spaces = $derived(app.spaces);
	const activeSpaceId = $derived(
		(mode === 'trash' ? spaces.find((space) => space.id === app.trashSpaceId) : undefined)?.id ??
			spaces.find(
				(space) => space.kind === (mode === 'trash' || spaceKind === 'shared' ? SpaceKind.SHARED : SpaceKind.PRIVATE)
			)?.id ??
			''
	);
	const routeFolderId = $derived(mode === 'files' ? (page.url.searchParams.get('folder') ?? '') : '');
	const currentSort = $derived(mode === 'files' ? app.sortFor(activeSpaceId) : { by: 'NAME', direction: 'ASC' } as CatalogSort);
	const currentFileType = $derived(mode === 'files' ? app.fileTypeFor(activeSpaceId) : CatalogFileType.UNSPECIFIED);
	const currentList = $derived(
		accountReady && activeSpaceId ? app.peekList(mode, activeSpaceId, routeFolderId, currentSort, currentFileType) : undefined
	);
	let searchQuery = $state('');
	let showFilters = $state(false);
	let searchTerm = $state('');
	let searchResults = $state<SearchEntryResult[]>([]);
	let searchNext = $state('');
	let searchBusy = $state(false);
	let searchError = $state('');
	let searchGeneration = 0;
	let apiError = $state('');
	const viewError = $derived(apiError || app.accountError || currentList?.error || '');
	let notice = $state('');
	$effect(() => {
		if (notice) {
			toast.success(notice);
			notice = '';
		}
	});
	let pendingTrashEntry = $state<Entry | null>(null);
	let trashRequestPending = $state(false);
	let trashError = $state('');
	let pendingDelete = $state<TrashItem | null>(null);
	let deletePending = $state(false);
	let deleteError = $state('');
	let selectedTrashIds = $state<string[]>([]);
	let bulkDeleteOpen = $state(false);
	let bulkDeleteBusy = $state(false);
	let bulkDeleteError = $state('');
	let bulkDeleteBatches = $state<{ entries: Entry[]; requestId: string; spaceId: string }[]>([]);
	let bulkRestoreBusy = $state(false);
	let bulkRestoreBatches: { entries: Entry[]; requestId: string; spaceId: string }[] = [];
	let view = $derived(mode);
	const folderPath = $derived(currentList?.path ?? []);
	const entries = $derived(currentList?.entries ?? []);
	const trashItems = $derived(currentList?.items ?? []);
	const selectedTrashEntries = $derived(trashItems.flatMap((item) => item.entry && selectedTrashIds.includes(item.entry.id) ? [item.entry] : []));
	const nextPageToken = $derived(currentList?.nextPageToken ?? '');
	const loading = $derived(!currentList?.initialized && !viewError);
	const listBusy = $derived(loading || currentList?.refreshing || currentList?.loadingNext);
	let folderName = $state('');
	let folderError = $state('');
	let folderBusy = $state(false);
	let renameBusy = $state(false);
	let pendingRestoreIds = $state<string[]>([]);
	let showCreateFolder = $state(false);
	let pendingFolderRequest = $state.raw<CreateFolderRequest | null>(null);
	let renamingEntry = $state<Entry | null>(null);
	let renameValue = $state('');
	let movingEntry = $state<Entry | null>(null);
	let previewEntry = $state<Entry | null>(null);
	let sharingEntry = $state<Entry | null>(null);
	let detailsEntry = $state<Entry | null>(null);

	let fileInput = $state<HTMLInputElement>();
	const uploadLimitBytes = $derived(app.uploadLimitBytes);
	const uploadLimitError = $derived(app.uploadLimitError);

	const activeSpace = $derived(spaces.find((space) => space.id === activeSpaceId));
	const currentParentId = $derived(routeFolderId || undefined);
	const routeFolderReady = $derived(
		!!currentList?.initialized &&
			!currentList.error &&
			routeFolderId === (folderPath.at(-1)?.id ?? '')
	);
	const isSharedSpace = $derived(activeSpace?.kind === SpaceKind.SHARED);
	const folders = $derived(entries.filter((entry) => entry.kind === EntryKind.FOLDER));
	const files = $derived(entries.filter((entry) => entry.kind === EntryKind.FILE));
	const displayedEntries = $derived([...folders, ...files]);
	let selectedIds = $state<string[]>([]);
	let selectionMode = $state(false);
	let lastSelectedIndex = -1;
	let longPressTimer: ReturnType<typeof setTimeout> | undefined;
	let touchStart: { x: number; y: number; entry: Entry } | undefined;
	let suppressMobileClickId = '';
	let movingEntries = $state<Entry[]>([]);
	let bulkTrashOpen = $state(false);
	let bulkTrashBusy = $state(false);
	let bulkTrashTarget = $state<Entry[]>([]);
	let bulkTrashResults = $state<{ entry: Entry; error?: string }[]>([]);
	let dropTargetId = $state('');
	const selectedEntries = $derived(displayedEntries.filter((entry) => selectedIds.includes(entry.id)));
	const allLoadedSelected = $derived(displayedEntries.length > 0 && selectedEntries.length === displayedEntries.length);
	const partiallySelected = $derived(selectedEntries.length > 0 && !allLoadedSelected);

	$effect(() => {
		const scope = `${mode}:${activeSpaceId}:${routeFolderId}:${app.sessionVersion}`;
		untrack(() => {
			void scope;
			closeSearch();
			selectedIds = [];
			selectedTrashIds = [];
			selectionMode = false;
			lastSelectedIndex = -1;
			movingEntries = [];
		});
	});

	function changeSelection(entry: Entry, checked: boolean, event: MouseEvent | KeyboardEvent): void {
		const entriesInView = displayedEntries;
		const index = entriesInView.findIndex((item) => item.id === entry.id);
		let next = [...selectedIds];
		if (event.shiftKey && lastSelectedIndex >= 0 && index >= 0) {
			const start = Math.min(lastSelectedIndex, index);
			const end = Math.max(lastSelectedIndex, index);
			for (const item of entriesInView.slice(start, end + 1)) {
				if (checked && !next.includes(item.id)) next.push(item.id);
				else if (!checked) next = next.filter((id) => id !== item.id);
			}
		} else if (checked && !next.includes(entry.id)) next.push(entry.id);
		else if (!checked) next = next.filter((id) => id !== entry.id);
		selectedIds = next;
		lastSelectedIndex = index;
		if (selectedIds.length) selectionMode = true;
	}

	function toggleSelectAllLoaded(): void {
		if (allLoadedSelected) {
			const loaded = displayedEntries.map((entry) => entry.id);
			selectedIds = selectedIds.filter((id) => !loaded.includes(id));
		} else {
			selectedIds = [...selectedIds, ...displayedEntries.map((entry) => entry.id).filter((id) => !selectedIds.includes(id))];
		}
		selectionMode = selectedIds.length > 0;
	}

	function clearSelection(): void {
		selectedIds = [];
		selectionMode = false;
		lastSelectedIndex = -1;
	}

	function startLongPress(entry: Entry, event: PointerEvent): void {
		if (event.pointerType !== 'touch' || selectionMode) return;
		clearTimeout(longPressTimer);
		touchStart = { x: event.clientX, y: event.clientY, entry };
		longPressTimer = setTimeout(() => {
			selectionMode = true;
			if (!selectedIds.includes(entry.id)) selectedIds = [...selectedIds, entry.id];
			lastSelectedIndex = displayedEntries.findIndex((item) => item.id === entry.id);
			suppressMobileClickId = entry.id;
		}, 600);
	}

	function moveLongPress(event: PointerEvent): void {
		if (!touchStart) return;
		if (Math.abs(event.clientX - touchStart.x) > 12 || Math.abs(event.clientY - touchStart.y) > 12) {
			clearTimeout(longPressTimer);
			longPressTimer = undefined;
		}
	}

	function endLongPress(event: PointerEvent): void {
		const start = touchStart;
		if (start && event.pointerType === 'touch' && !selectionMode) {
			const horizontal = event.clientX - start.x;
			const vertical = event.clientY - start.y;
			if (Math.abs(horizontal) >= 80 && Math.abs(vertical) < 30 && (horizontal < 0 || start.entry.kind === EntryKind.FILE)) {
				event.preventDefault();
				suppressMobileClickId = start.entry.id;
				if (horizontal > 0 && start.entry.kind === EntryKind.FILE) sharingEntry = start.entry;
				else if (horizontal < 0) requestTrashConfirmation(start.entry);
			}
		}
		clearTimeout(longPressTimer);
		longPressTimer = undefined;
		touchStart = undefined;
	}

	function cancelLongPress(): void {
		clearTimeout(longPressTimer);
		longPressTimer = undefined;
		touchStart = undefined;
	}

	function openOrSelectMobile(entry: Entry): void {
		if (suppressMobileClickId === entry.id) {
			suppressMobileClickId = '';
			return;
		}
		if (selectionMode) {
			selectedIds = selectedIds.includes(entry.id) ? selectedIds.filter((id) => id !== entry.id) : [...selectedIds, entry.id];
			if (!selectedIds.length) selectionMode = false;
			return;
		}
		if (entry.kind === EntryKind.FOLDER) void openFolder(entry);
		else openFile(entry);
	}

	function formatBytes(size: bigint | undefined): string {
		if (size === undefined) return '—';
		const bytes = Number(size);
		if (bytes < 1000) return `${bytes} B`;
		const units = ['KB', 'MB', 'GB'];
		let value = bytes / 1000;
		let unit = 0;
		while (value >= 1000 && unit < units.length - 1) {
			value /= 1000;
			unit++;
		}
		return `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
	}

	function formatCreatedAt(createdAt: Entry['createdAt']): string {
		return createdAt ? timestampDate(createdAt).toLocaleDateString('pl-PL') : '—';
	}

	function updateSort(value: string): void {
		const [by, direction] = value.split(':') as [CatalogSortBy, CatalogSortDirection];
		app.setSort(activeSpaceId, { by, direction });
		if (searchTerm) void runSearch(false, { by, direction }, currentFileType, searchTerm);
	}

	async function runSearch(next = false, sort: CatalogSort = currentSort, fileType: CatalogFileType = currentFileType, submittedQuery?: string): Promise<void> {
		const query = submittedQuery ?? (next ? searchTerm : searchQuery.trim());
		if (!query || !activeSpaceId || searchBusy && next) return;
		const generation = ++searchGeneration;
		const spaceId = activeSpaceId;
		if (!next) { searchTerm = query; searchResults = []; searchNext = ''; }
		searchBusy = true;
		searchError = '';
		try {
			const response = await catalog.searchEntries(create(SearchEntriesRequestSchema, {
				spaceId, query, pageSize: 50, pageToken: next ? searchNext : '',
				sortBy: CatalogSortByProto[sort.by], sortDirection: CatalogSortDirectionProto[sort.direction], fileType
			}));
			if (generation !== searchGeneration || spaceId !== activeSpaceId) return;
			searchResults = next ? [...searchResults, ...response.results] : response.results;
			searchNext = response.nextPageToken;
		} catch (error) {
			if (generation === searchGeneration) searchError = errorMessage(error);
		} finally {
			if (generation === searchGeneration) searchBusy = false;
		}
	}
	function updateFileType(value: string): void {
		const fileType = Number(value) as CatalogFileType;
		app.setFileType(activeSpaceId, fileType);
		if (searchTerm) void runSearch(false, currentSort, fileType, searchTerm);
	}
	function resetFilters(): void {
		const sort: CatalogSort = { by: 'NAME', direction: 'ASC' };
		app.setFileType(activeSpaceId, CatalogFileType.UNSPECIFIED);
		app.setSort(activeSpaceId, sort);
		if (searchTerm) void runSearch(false, sort, CatalogFileType.UNSPECIFIED, searchTerm);
	}
	function closeSearch(): void {
		searchGeneration++;
		searchTerm = '';
		searchQuery = '';
		searchResults = [];
		searchNext = '';
		searchBusy = false;
		searchError = '';
	}
	async function openSearchFolder(folderId?: string): Promise<void> {
		closeSearch();
		await goto(resolve(folderHref(folderId)));
	}

	function storageLocationLabel(location: StorageLocation | undefined): string {
		if (location === StorageLocation.R2) return 'R2';
		if (location === StorageLocation.RUSTFS) return 'RustFS';
		return '';
	}

	async function loadEntries(loadNext = false): Promise<void> {
		if (currentList) await app.load(currentList, loadNext ? { next: true } : { force: true });
	}
	async function loadTrash(loadNext = false): Promise<void> {
		await loadEntries(loadNext);
	}
	async function refreshStaleEntry(
		error: unknown,
		list = currentList,
		entryId?: string
	): Promise<boolean> {
		if (!(error instanceof ConnectError) || ![Code.Aborted, Code.NotFound].includes(error.code))
			return false;
		if (list) {
			const version = app.sessionVersion;
			const pending = list.pending;
			list.version++;
			list.dirty = true;
			if (error.code === Code.NotFound && entryId) {
				list.entries = list.entries.filter((entry) => entry.id !== entryId);
				list.items = list.items.filter((item) => item.entry?.id !== entryId);
			}
			// A prior refresh uses an older version. Wait for it, then reconcile even an inactive list.
			await pending;
			if (version === app.sessionVersion) await app.load(list, { force: true });
		}
		return true;
	}
	async function refreshView(): Promise<void> {
		await loadEntries();
	}
	async function loadAccount(): Promise<void> {
		await app.ensureAccount();
		if (app.accountReady && !activeSpaceId) apiError = 'Przestrzeń jest niedostępna.';
	}
	function switchTrashSpace(kind: 'private' | 'shared'): void {
		const target = spaces.find(
			(space) => space.kind === (kind === 'shared' ? SpaceKind.SHARED : SpaceKind.PRIVATE)
		);
		if (!target) {
			apiError = 'Przestrzeń jest niedostępna.';
			return;
		}
		apiError = '';
		notice = '';
		app.trashSpaceId = target.id;
	}
	$effect(() => {
		const spaceId = activeSpaceId;
		const folderId = mode === 'files' ? (page.url.searchParams.get('folder') ?? '') : '';
		const currentMode = mode;
		if (!accountReady || !spaceId) return;
		const sort = currentMode === 'files' ? app.sortFor(spaceId) : undefined;
		const fileType = currentMode === 'files' ? app.fileTypeFor(spaceId) : CatalogFileType.UNSPECIFIED;
		untrack(() => {
			const list = sort ? app.list(currentMode, spaceId, folderId, sort, fileType) : app.list(currentMode, spaceId, folderId);
			app.activeListKey = list.key;
			if (currentMode === 'files') app.lastFolders[spaceKind === 'shared' ? '/' : '/personal'] = folderId;
			void app.load(list);
		});
	});
	onMount(() => {
		void loadAccount();
		void app.loadUploadLimit();
		return () => {
			searchGeneration++;
			if (app.activeListKey === currentList?.key) app.activeListKey = '';
		};
	});

	async function openFolder(entry: Entry): Promise<void> {
		await goto(resolve(folderHref(entry.id)));
	}

	async function goToBreadcrumb(index: number): Promise<void> {
		const folder = index < 0 ? undefined : folderPath[index];
		await goto(resolve(folderHref(folder?.id)));
	}

	function folderHref(folderId?: string): AppRouteWithQuery {
		const url = new URL(page.url.href);
		if (folderId) url.searchParams.set('folder', folderId);
		else url.searchParams.delete('folder');
		return `${url.pathname}${url.search}` as AppRouteWithQuery;
	}

	const parentFolderName = $derived(
		folderPath.length > 1
			? folderPath[folderPath.length - 2].name
			: isSharedSpace
				? 'Main'
				: 'Pliki prywatne'
	);

	async function createFolder(): Promise<void> {
		if (
			folderBusy ||
			!routeFolderReady ||
			!activeSpaceId ||
			(!folderName.trim() && !pendingFolderRequest)
		)
			return;
		folderError = '';
		folderBusy = true;
		const version = app.sessionVersion;
		if (!pendingFolderRequest) {
			pendingFolderRequest = create(CreateFolderRequestSchema, {
				spaceId: activeSpaceId,
				...(currentParentId ? { parentId: currentParentId } : {}),
				name: folderName,
				requestId: crypto.randomUUID()
			});
		}
		try {
			const result = await catalog.createFolder(pendingFolderRequest);
			if (version !== app.sessionVersion) return;
			app.changed(pendingFolderRequest.spaceId, pendingFolderRequest.parentId ?? '', result.entry);
			pendingFolderRequest = null;
			folderName = '';
			showCreateFolder = false;
			notice = 'Folder został utworzony.';
		} catch (error) {
			if (version !== app.sessionVersion) return;
			folderError = errorMessage(error);
		} finally {
			folderBusy = false;
		}
	}

	function beginRename(entry: Entry): void {
		renamingEntry = entry;
		renameValue = entry.name;
		apiError = '';
	}

	function beginMove(entry: Entry): void {
		movingEntry = entry;
		movingEntries = [];
		apiError = '';
	}

	async function saveRename(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (renameBusy || !renamingEntry || !renameValue.trim()) return;
		renameBusy = true;
		const originList = currentList;
		const version = app.sessionVersion;
		try {
			const result = await catalog.renameEntry(
				create(RenameEntryRequestSchema, {
					spaceId: activeSpaceId,
					entryId: renamingEntry.id,
					name: renameValue,
					expectedRevision: renamingEntry.revision
				})
			);
			if (version !== app.sessionVersion) return;
			app.changed(originList!.spaceId, originList!.parentId, result.entry);
			renamingEntry = null;
			notice = 'Nazwa została zmieniona.';
		} catch (error) {
			if (version !== app.sessionVersion) return;
			const message = errorMessage(error);
			if (await refreshStaleEntry(error, originList, renamingEntry?.id)) {
				renamingEntry = originList?.entries.find((item) => item.id === renamingEntry?.id) ?? null;
				apiError = message;
			} else apiError = message;
		} finally {
			renameBusy = false;
		}
	}

	function requestTrashConfirmation(entry: Entry): void {
		apiError = '';
		notice = '';
		trashError = '';
		pendingTrashEntry = entry;
	}

	async function moveToTrash(): Promise<void> {
		const entry = pendingTrashEntry;
		if (!entry || trashRequestPending) return;
		trashRequestPending = true;
		const originList = currentList!;
		const version = app.sessionVersion;
		trashError = '';
		try {
			await trash.trashEntry(
				create(TrashEntryRequestSchema, {
					spaceId: activeSpaceId,
					entryId: entry.id,
					expectedRevision: entry.revision
				})
			);
			if (version !== app.sessionVersion) return;
			app.changed(originList.spaceId, originList.parentId, undefined, entry.id);
			notice = 'Element przeniesiono do kosza.';
			pendingTrashEntry = null;
		} catch (error) {
			if (version !== app.sessionVersion) return;
			const message = errorMessage(error);
			if (await refreshStaleEntry(error, originList, entry.id)) {
				pendingTrashEntry = null;
				apiError = message;
			} else trashError = message;
		} finally {
			trashRequestPending = false;
		}
	}

	let restoreConflict = $state<{ item: TrashItem; name: string; spaceId: string; target?: Entry } | null>(null);
	async function restoreTrashItem(item: TrashItem, newName?: string, replacement?: Entry): Promise<void> {
		if (!item.entry || pendingRestoreIds.includes(item.entry.id)) return;
		const originList = currentList!;
		const version = app.sessionVersion;
		pendingRestoreIds.push(item.entry.id);
		try {
			const result = await trash.restoreEntry(
				create(RestoreEntryRequestSchema, {
					spaceId: originList.spaceId,
					entryId: item.entry!.id,
					expectedRevision: item.entry!.revision,
					...(newName !== undefined ? { newName } : {}),
					...(replacement ? {replaceEntryId: replacement.id, replaceExpectedRevision: replacement.revision} : {})
				})
			);
			if (version !== app.sessionVersion) return;
			originList.items = originList.items.filter((value) => value.entry?.id !== item.entry!.id);
			app.changed(originList.spaceId, result.entry?.parentId ?? '', result.entry);
			notice = `„${item.entry!.name}” przywrócono.`;
		} catch (error) {
			if (version !== app.sessionVersion) return;
			if (error instanceof ConnectError && error.code === Code.AlreadyExists && item.entry) {
				try {
					const occupied = new SvelteSet<string>();
					let target: Entry | undefined;
					let token = '';
					do {
						const response = await catalog.listEntries(create(ListEntriesRequestSchema, {
							spaceId: originList.spaceId,
							...(item.entry.parentId ? {parentId: item.entry.parentId} : {}),
							pageSize: 100, pageToken: token
						}));
						for (const entry of response.entries) {
							occupied.add(uploadNameKey(entry.name));
							if (uploadNameKey(entry.name) === uploadNameKey(item.entry.name)) target = entry;
						}
						token = response.nextPageToken;
					} while (token);
					if (version === app.sessionVersion) restoreConflict = { item, name: nextAvailableUploadName(item.entry.name, occupied), spaceId: originList.spaceId, ...(item.entry.kind === EntryKind.FILE && target?.kind === EntryKind.FILE ? {target} : {}) };
				} catch (cause) { apiError = errorMessage(cause); }
			} else {
				const message = errorMessage(error);
				await refreshStaleEntry(error, originList, item.entry?.id);
				apiError = message;
			}
		} finally {
			pendingRestoreIds = pendingRestoreIds.filter((id) => id !== item.entry!.id);
		}
	}

	function permanentlyDelete(item: TrashItem): void {
		pendingDelete = item;
		deleteError = '';
	}
	function toggleTrashSelection(id: string, checked: boolean): void {
		selectedTrashIds = checked ? [...selectedTrashIds.filter((value) => value !== id), id] : selectedTrashIds.filter((value) => value !== id);
	}
	function requestBulkDelete(): void {
		bulkDeleteBatches = [];
		for (let i = 0; i < selectedTrashEntries.length; i += 100) bulkDeleteBatches.push({ entries: selectedTrashEntries.slice(i, i + 100), requestId: crypto.randomUUID(), spaceId: activeSpaceId });
		bulkDeleteError = '';
		bulkDeleteOpen = true;
	}
	async function restoreSelectedTrash(): Promise<void> {
		if (bulkRestoreBusy || !selectedTrashEntries.length || !currentList) return;
		const selectedKey = JSON.stringify(selectedTrashEntries.map((entry) => [entry.id, entry.revision]));
		const pendingKey = JSON.stringify(bulkRestoreBatches.flatMap((batch) => batch.entries.map((entry) => [entry.id, entry.revision])));
		if (selectedKey !== pendingKey || bulkRestoreBatches.some((batch) => batch.spaceId !== activeSpaceId)) {
			bulkRestoreBatches = [];
			for (let i = 0; i < selectedTrashEntries.length; i += 100) bulkRestoreBatches.push({ entries: selectedTrashEntries.slice(i, i + 100), requestId: crypto.randomUUID(), spaceId: activeSpaceId });
		}
		bulkRestoreBusy = true;
		apiError = '';
		const originList = currentList;
		const version = app.sessionVersion;
		const pending: typeof bulkRestoreBatches = [];
		const succeeded: Entry[] = [];
		let failedCount = 0;
		for (const batch of bulkRestoreBatches) {
			try {
				const response = await trash.bulkRestoreEntries(create(BulkRestoreEntriesRequestSchema, { spaceId: batch.spaceId, requestId: batch.requestId, items: batch.entries.map((entry) => ({ entryId: entry.id, expectedRevision: entry.revision })) }));
				if (response.results.length !== batch.entries.length || response.results.some((result, index) => result.entryId !== batch.entries[index].id)) throw new Error('Nieprawidłowa odpowiedź serwera.');
				const failed: Entry[] = [];
				response.results.forEach((result, index) => { if (result.success) succeeded.push(batch.entries[index]); else failed.push(batch.entries[index]); });
				if (failed.length) pending.push({ ...batch, entries: failed, requestId: crypto.randomUUID() });
				failedCount += failed.length;
			} catch {
				pending.push(batch);
				failedCount += batch.entries.length;
			}
		}
		bulkRestoreBatches = pending;
		if (version === app.sessionVersion) {
			const ids = new Set(succeeded.map((entry) => entry.id));
			originList.items = originList.items.filter((item) => !item.entry || !ids.has(item.entry.id));
			for (const entry of succeeded) app.changed(originList.spaceId, entry.parentId ?? '');
			if (activeSpaceId === originList.spaceId) selectedTrashIds = selectedTrashIds.filter((id) => !ids.has(id));
			if (failedCount) apiError = `Przywrócono ${succeeded.length}; nie udało się przywrócić ${failedCount}. Zaznaczenie zachowano.`;
			else notice = `Przywrócono ${succeeded.length} elementów.`;
		}
		bulkRestoreBusy = false;
	}
	async function confirmBulkDelete(): Promise<void> {
		if (bulkDeleteBusy || !bulkDeleteBatches.length || !currentList) return;
		bulkDeleteBusy = true;
		const originList = currentList;
		const version = app.sessionVersion;
		const pending: typeof bulkDeleteBatches = [];
		const succeeded: Entry[] = [];
		let failedCount = 0;
		for (const batch of bulkDeleteBatches) {
			try {
				const response = await trash.bulkDeletePermanently(create(BulkDeletePermanentlyRequestSchema, { spaceId: batch.spaceId, requestId: batch.requestId, items: batch.entries.map((entry) => ({ entryId: entry.id, expectedRevision: entry.revision })) }));
				if (response.results.length !== batch.entries.length || response.results.some((result, index) => result.entryId !== batch.entries[index].id)) throw new Error('Nieprawidłowa odpowiedź serwera.');
				const failed: Entry[] = [];
				response.results.forEach((result, index) => { if (result.success) succeeded.push(batch.entries[index]); else failed.push(batch.entries[index]); });
				if (failed.length) pending.push({ ...batch, entries: failed, requestId: crypto.randomUUID() });
				failedCount += failed.length;
			} catch {
				pending.push(batch);
				failedCount += batch.entries.length;
			}
		}
		bulkDeleteBatches = pending;
		if (version === app.sessionVersion) {
			const ids = new Set(succeeded.map((entry) => entry.id));
			originList.items = originList.items.filter((item) => !item.entry || !ids.has(item.entry.id));
			for (const entry of succeeded) app.changed(originList.spaceId, entry.parentId ?? '');
			if (activeSpaceId === originList.spaceId) selectedTrashIds = selectedTrashIds.filter((id) => !ids.has(id));
			if (failedCount) bulkDeleteError = `Zlecono usunięcie ${succeeded.length}; nie udało się usunąć ${failedCount}. Zaznaczenie zachowano.`;
			else { bulkDeleteOpen = false; notice = `Zlecono trwałe usunięcie: ${succeeded.length} elementów.`; }
		}
		bulkDeleteBusy = false;
	}
	async function confirmDelete(): Promise<void> {
		const entry = pendingDelete?.entry;
		if (!entry || deletePending) return;
		deletePending = true;
		const originList = currentList!;
		const version = app.sessionVersion;
		try {
			const result = await trash.deletePermanently(
				create(DeletePermanentlyRequestSchema, {
					spaceId: activeSpaceId,
					entryId: entry.id,
					expectedRevision: entry.revision
				})
			);
			if (version !== app.sessionVersion) return;
			if (result.accepted) {
				pendingDelete = null;
				originList.items = originList.items.filter((item) => item.entry?.id !== entry.id);
				app.changed(originList.spaceId, entry.parentId ?? '');
				notice = 'Żądanie trwałego usunięcia zostało przyjęte.';
			}
		} catch (error) {
			if (version !== app.sessionVersion) return;
			if (await refreshStaleEntry(error, originList, entry.id)) {
				pendingDelete = null;
				apiError = errorMessage(error);
			} else deleteError = errorMessage(error);
		} finally {
			deletePending = false;
		}
	}

	async function downloadFile(entry: Entry): Promise<void> {
		apiError = '';
		const originList = currentList;
		const version = app.sessionVersion;
		try {
			const result = await catalog.getDownload(
				create(GetDownloadRequestSchema, { spaceId: activeSpaceId, entryId: entry.id })
			);
			if (version !== app.sessionVersion) return;
			const link = document.createElement('a');
			link.href = result.url;
			link.rel = 'noopener';
			link.download = entry.name;
			link.click();
		} catch (error) {
			if (version !== app.sessionVersion) return;
			await refreshStaleEntry(error, originList, entry.id);
			apiError = errorMessage(error);
		}
	}

	async function runWithConcurrency<T>(items: T[], concurrency: number, action: (item: T) => Promise<void>): Promise<void> {
		let nextIndex = 0;
		const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
			while (nextIndex < items.length) {
				const item = items[nextIndex++];
				if (item !== undefined) await action(item);
			}
		});
		await Promise.all(workers);
	}

	async function downloadSelected(): Promise<void> {
		const filesToDownload = selectedEntries.filter((entry) => entry.kind === EntryKind.FILE);
		const foldersSkipped = selectedEntries.filter((entry) => entry.kind === EntryKind.FOLDER);
		if (!filesToDownload.length) {
			toast.error('Zaznaczone elementy to foldery. Pobieranie zbiorcze obejmuje tylko pliki.');
			return;
		}
		const failures: Entry[] = [];
		await runWithConcurrency(filesToDownload, 4, async (entry) => {
			try {
				const result = await catalog.getDownload(create(GetDownloadRequestSchema, { spaceId: activeSpaceId, entryId: entry.id }));
				const link = document.createElement('a');
				link.href = result.url;
				link.rel = 'noopener';
				link.download = entry.name;
				link.click();
			} catch {
				failures.push(entry);
			}
		});
		selectedIds = [...foldersSkipped, ...failures].map((entry) => entry.id);
		if (!selectedIds.length) selectionMode = false;
		const skippedLabel = foldersSkipped.length ? ` Pominięto foldery: ${foldersSkipped.length}.` : '';
		if (failures.length) toast.error(`Nie udało się pobrać ${failures.length} z ${filesToDownload.length} plików.${skippedLabel}`);
		else toast.success(`Przygotowano pobieranie ${filesToDownload.length} plików.${skippedLabel}`);
	}

	function requestBulkTrash(): void {
		bulkTrashTarget = [...selectedEntries];
		bulkTrashBatches = [];
		for (let i = 0; i < bulkTrashTarget.length; i += 100) bulkTrashBatches.push({ entries: bulkTrashTarget.slice(i, i + 100), requestId: crypto.randomUUID(), spaceId: activeSpaceId });
		bulkTrashResults = [];
		trashError = '';
		bulkTrashOpen = true;
	}
	let bulkTrashBatches: { entries: Entry[]; requestId: string; spaceId: string }[] = [];

	async function trashSelected(): Promise<void> {
		if (bulkTrashBusy || !bulkTrashTarget.length) return;
		bulkTrashBusy = true;
		const version = app.sessionVersion;
		const spaceId = bulkTrashBatches[0]?.spaceId ?? activeSpaceId;
		const results: { entry: Entry; error?: string }[] = [];
		const pending: typeof bulkTrashBatches = [];
		for (const batch of bulkTrashBatches) {
			try {
				const response = await trash.bulkTrashEntries(create(BulkTrashEntriesRequestSchema, { spaceId: batch.spaceId, requestId: batch.requestId, items: batch.entries.map((entry) => ({ entryId: entry.id, expectedRevision: entry.revision })) }));
				if (response.results.length !== batch.entries.length || response.results.some((result, index) => result.entryId !== batch.entries[index].id)) throw new Error('Nieprawidłowa odpowiedź serwera.');
				const failed: Entry[] = [];
				response.results.forEach((result, index) => {
					const entry = batch.entries[index];
					if (result.success) results.push({ entry });
					else {
						failed.push(entry);
						const code = result.error === 'REVISION_CONFLICT' ? Code.Aborted : result.error === 'NOT_FOUND' ? Code.NotFound : Code.Unknown;
						results.push({ entry, error: errorMessage(new ConnectError(result.error || 'Nie udało się wykonać operacji.', code)) });
					}
				});
				if (failed.length) pending.push({ ...batch, entries: failed, requestId: crypto.randomUUID() });
			} catch (cause) {
				pending.push(batch);
				for (const entry of batch.entries) results.push({ entry, error: errorMessage(cause) });
			}
		}
		bulkTrashBatches = pending;
		if (version === app.sessionVersion) {
			const succeeded = results.filter((result) => !result.error);
			const failed = results.filter((result) => result.error);
			for (const result of succeeded) app.changed(spaceId, result.entry.parentId ?? '', undefined, result.entry.id);
			selectedIds = failed.map((result) => result.entry.id);
			bulkTrashTarget = failed.map((result) => result.entry);
			bulkTrashResults = results;
			if (!failed.length) {
				bulkTrashOpen = false;
				selectionMode = false;
				notice = `Przeniesiono do kosza: ${succeeded.length} elementów.`;
			} else {
				trashError = `Przeniesiono ${succeeded.length}; nie udało się przenieść ${failed.length}. Zaznaczenie zachowano dla nieobsłużonych elementów.`;
			}
		}
		bulkTrashBusy = false;
	}

	function beginMoveSelected(): void {
		if (!selectedEntries.length) return;
		movingEntries = [...selectedEntries];
		movingEntry = selectedEntries[0];
		apiError = '';
	}

	function beginEntryDrag(entry: Entry, event: DragEvent): void {
		if (!event.dataTransfer) return;
		event.dataTransfer.setData('application/x-unisource-entry', entry.id);
		event.dataTransfer.effectAllowed = 'move';
	}

	function dragOverFolder(folder: Entry | undefined, event: DragEvent): void {
		if (!event.dataTransfer?.types.includes('application/x-unisource-entry')) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'move';
		dropTargetId = folder?.id ?? '__root__';
	}

	function endFolderDrag(): void {
		dropTargetId = '';
	}

	async function dropEntryOnFolder(folder: Entry | undefined, event: DragEvent): Promise<void> {
		if (!event.dataTransfer?.types.includes('application/x-unisource-entry')) return;
		event.preventDefault();
		const id = event.dataTransfer.getData('application/x-unisource-entry');
		const entry = displayedEntries.find((item) => item.id === id);
		endFolderDrag();
		if (!entry || (entry.parentId ?? '') === (folder?.id ?? '') || (entry.kind === EntryKind.FOLDER && entry.id === folder?.id)) return;
		try {
			const result = await catalog.moveEntry(create(MoveEntryRequestSchema, {
				spaceId: activeSpaceId,
				entryId: entry.id,
				...(folder ? { parentId: folder.id } : {}),
				expectedRevision: entry.revision
			}));
			if (result.entry) {
				app.entryMoved(activeSpaceId, result.entry, entry.parentId ?? '');
				notice = `Przeniesiono „${entry.name}”.`;
			}
		} catch (cause) {
			await refreshStaleEntry(cause, currentList, entry.id);
			apiError = errorMessage(cause);
		}
	}

	function openFile(entry: Entry): void {
		if (mediaKindForFilename(entry.name)) previewEntry = entry;
		else void downloadFile(entry);
	}

	type UploadConflictChoice = 'keep' | 'replace' | 'skip';
	let uploadConflict = $state<{ name: string; canReplace: boolean } | null>(null);
	let uploadConflictResolve: ((choice: UploadConflictChoice) => void) | undefined;
	let selectingUploads = false;
	let uploadsViewDestroyed = false;
	function chooseUploadConflict(choice: UploadConflictChoice): void {
		const resolve = uploadConflictResolve;
		uploadConflictResolve = undefined;
		uploadConflict = null;
		resolve?.(choice);
	}
	onDestroy(() => { uploadsViewDestroyed = true; chooseUploadConflict('skip'); });
	async function uploadFiles(files: File[]): Promise<void> {
		if (!accountReady || !routeFolderReady || uploadLimitBytes === null || selectingUploads) return;
		selectingUploads = true;
		const destination = {
			spaceId: activeSpaceId,
			...(currentParentId ? { parentId: currentParentId } : {}),
			mode: app.defaultUploadMode,
			label: [isSharedSpace ? 'Main' : 'Pliki prywatne', ...folderPath.map((folder) => folder.name)].join(' / ')
		};
		const maxBytes = Number(uploadLimitBytes);
		try {
			const occupied = new SvelteMap<string, Entry | null>();
			let token = '';
			do {
				const page = await catalog.listEntries(create(ListEntriesRequestSchema, {
					spaceId: destination.spaceId, ...(destination.parentId ? {parentId: destination.parentId} : {}),
					pageSize: 100, pageToken: token
				}));
				for (const entry of page.entries) occupied.set(uploadNameKey(entry.name), entry);
				token = page.nextPageToken;
			} while (token);
			for (const task of app.transfers.tasks) {
				if (task.target.spaceId === destination.spaceId && (task.target.parentId ?? '') === (destination.parentId ?? '') && !['done', 'cancelled', 'error'].includes(task.phase)) occupied.set(uploadNameKey(task.name), null);
			}
			for (const file of files) {
				if (uploadsViewDestroyed) break;
				let name = file.name.normalize('NFC');
				const key = uploadNameKey(name);
				const existing = occupied.get(key);
				let replacement: { replaceEntryId: string; replaceExpectedRevision: number } | undefined;
				if (occupied.has(key)) {
					const choice = await new Promise<UploadConflictChoice>((resolve) => {
						uploadConflictResolve = resolve;
						uploadConflict = { name, canReplace: existing?.kind === EntryKind.FILE };
					});
					if (uploadsViewDestroyed) break;
					if (choice === 'skip') continue;
					if (choice === 'replace' && existing?.kind === EntryKind.FILE) replacement = {replaceEntryId: existing.id, replaceExpectedRevision: existing.revision};
					else name = nextAvailableUploadName(name, new Set(occupied.keys()));
				}
				occupied.set(uploadNameKey(name), null);
				app.transfers.enqueue([file], { ...destination, name, ...replacement }, maxBytes);
			}
		} catch (error) {
			apiError = errorMessage(error);
		} finally {
			selectingUploads = false;
		}
	}

	function onFileSelected(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const files = Array.from(input.files ?? []);
		input.value = '';
		if (files.length) void uploadFiles(files);
	}

	function onPageDragOver(event: DragEvent): void {
		if (!event.dataTransfer?.types.includes('Files')) return;
		event.preventDefault();
		event.dataTransfer.dropEffect = 'copy';
	}

	function onPageDrop(event: DragEvent): void {
		if (event.dataTransfer?.types.includes('application/x-unisource-entry')) {
			event.preventDefault();
			return;
		}
		event.preventDefault();
		const files = Array.from(event.dataTransfer?.files ?? []);
		if (files.length && view === 'files') void uploadFiles(files);
	}

	function loadNextPage(): void {
		if (view === 'trash') void loadTrash(true);
		else void loadEntries(true);
	}

	async function loadUploadLimit(): Promise<void> {
		await app.loadUploadLimit(true);
	}

	function entryActions(entry: Entry, includeDownload: boolean) {
		return [
			...(includeDownload && entry.kind !== EntryKind.FOLDER ? [{ id: 'download', label: 'Pobierz', run: () => void downloadFile(entry) }] : []),
			{ id: 'share', label: 'Udostępnij', run: () => sharingEntry = entry },
			{ id: 'move', label: 'Przenieś', run: () => beginMove(entry) },
			{ id: 'rename', label: 'Zmień nazwę', run: () => beginRename(entry) },
			{ id: 'details', label: 'Szczegóły', run: () => detailsEntry = entry },
			{ id: 'trash', label: 'Do kosza', destructive: true, run: () => requestTrashConfirmation(entry) }
		];
	}
</script>

<svelte:window
	ondragover={onPageDragOver}
	ondrop={onPageDrop}
/>

<h1 class="sr-only">{view === 'trash' ? 'Kosz' : isSharedSpace ? 'Pliki wspólne' : 'Pliki prywatne'}</h1>

<div class="space-y-4">
	{#if view === 'files'}
		<div class="flex flex-col gap-3 border-b border-border-line pb-4">
			<nav class="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 text-sm leading-none whitespace-nowrap" aria-label="Ścieżka">
			<a href={resolve(folderHref())} ondragover={(event) => dragOverFolder(undefined, event)} ondragleave={endFolderDrag} ondrop={(event) => void dropEntryOnFolder(undefined, event)} class="inline-flex h-5 shrink-0 items-center font-semibold text-text-main hover:underline {dropTargetId === '__root__' ? 'rounded bg-primary/10' : ''}">{isSharedSpace ? 'Pliki wspólne' : 'Pliki prywatne'}</a>
				{#each folderPath as folder, index (folder.id)}
					<span class="inline-flex h-5 shrink-0 items-center text-text-muted" aria-hidden="true"><CaretRight class="h-3.5 w-3.5" /></span>
					<a href={resolve(folderHref(folder.id))} ondragover={(event) => dragOverFolder(folder, event)} ondragleave={endFolderDrag} ondrop={(event) => void dropEntryOnFolder(folder, event)} class="inline-flex h-5 max-w-[45vw] shrink-0 items-center truncate text-text-muted hover:text-text-main hover:underline sm:max-w-[160px] {dropTargetId === folder.id ? 'rounded bg-primary/10' : ''}" aria-current={index === folderPath.length - 1 ? 'page' : undefined}>{folder.name}</a>
				{/each}
			</nav>

			<div class="flex flex-wrap items-center gap-3">
				<div class="flex flex-wrap items-center gap-2">
					<label class="relative inline-flex h-11 cursor-pointer items-center gap-2 overflow-hidden rounded-lg bg-primary px-3 text-sm font-medium text-white shadow-sm transition-colors hover:bg-blue-700 focus-within:ring-2 focus-within:ring-primary/50 focus-within:ring-offset-2 lg:h-10">
						<CloudArrowUp class="h-4 w-4" />
						<span>Prześlij plik</span>
						<input bind:this={fileInput} type="file" multiple class="absolute inset-0 h-full w-full cursor-pointer opacity-0" disabled={uploadLimitBytes === null || !accountReady || !routeFolderReady} onchange={onFileSelected} aria-label="Wybierz pliki do przesłania" />
					</label>
					<button type="button" disabled={!routeFolderReady || !accountReady} onclick={() => (showCreateFolder = true)} class="hidden h-10 items-center gap-1.5 rounded-lg border border-border-line bg-transparent px-3 text-sm font-medium text-text-main transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 lg:inline-flex">
						<FolderPlus class="h-4 w-4" />
						<span>Nowy folder</span>
					</button>
					<div class="lg:hidden"><ActionMenu label="Akcje katalogu" triggerLabel="Dodatkowe akcje katalogu" items={[{ id: 'create-folder', label: 'Nowy folder', disabled: !routeFolderReady || !accountReady, run: () => showCreateFolder = true }]} /></div>
<button type="button" onclick={() => void refreshView()} disabled={listBusy || !activeSpaceId} class="flex h-10 w-10 items-center justify-center rounded-lg border border-border-line text-text-muted hover:bg-gray-100 hover:text-text-main disabled:opacity-50 dark:hover:bg-zinc-800" aria-label="Odśwież" title="Odśwież">
 {#if listBusy}<SpinnerGap class="h-5 w-5 animate-spin" />{:else}<ArrowClockwise class="h-5 w-5" />{/if}
 </button>
				</div>
				<div class="{showFilters ? 'flex' : 'hidden'} w-full flex-wrap items-center gap-3 lg:flex lg:w-auto">
				<label class="flex items-center gap-2 text-sm text-text-muted">
					<span>Typ</span><select aria-label="Typ pliku" value={String(currentFileType)} onchange={(event) => updateFileType(event.currentTarget.value)} disabled={!accountReady || !activeSpaceId} class="h-10 rounded-lg border border-border-line bg-bg-panel px-3 text-sm text-text-main">
						<option value="0">Wszystkie</option><option value="1">Obrazy</option><option value="2">PDF</option><option value="3">Audio</option><option value="4">Wideo</option><option value="5">Tekst i kod</option><option value="6">Pozostałe</option>
					</select>
				</label>
				<label class="flex items-center gap-2 text-sm text-text-muted">
					<span>Sortuj</span>
					<select aria-label="Sortowanie" value={`${currentSort.by}:${currentSort.direction}`} onchange={(event) => updateSort(event.currentTarget.value)} disabled={!accountReady || !activeSpaceId} class="h-10 rounded-lg border border-border-line bg-bg-panel px-3 text-sm text-text-main focus-visible:ring-2 focus-visible:ring-primary/50">
						<option value="NAME:ASC">Nazwa (A–Z)</option>
						<option value="NAME:DESC">Nazwa (Z–A)</option>
						<option value="CREATED_AT:ASC">Data utworzenia (od najstarszych)</option>
						<option value="CREATED_AT:DESC">Data utworzenia (od najnowszych)</option>
						<option value="MODIFIED_AT:ASC">Data modyfikacji (od najstarszych)</option>
						<option value="MODIFIED_AT:DESC">Data modyfikacji (od najnowszych)</option>
						<option value="SIZE:ASC">Rozmiar (od najmniejszych)</option>
						<option value="SIZE:DESC">Rozmiar (od największych)</option>
					</select>
				</label>
				{#if currentFileType !== CatalogFileType.UNSPECIFIED || currentSort.by !== 'NAME' || currentSort.direction !== 'ASC'}
					<button type="button" class="min-h-11 rounded-md px-3 text-sm text-primary underline" onclick={resetFilters}>Wyczyść filtry i sortowanie</button>
				{/if}
				</div>
			</div>
		</div>
		<form class="flex flex-wrap gap-2" onsubmit={(event) => { event.preventDefault(); void runSearch(); }}>
			<input aria-label="Szukaj w przestrzeni" bind:value={searchQuery} placeholder="Szukaj w przestrzeni" class="h-11 min-w-0 flex-1 rounded-lg border border-border-line bg-bg-panel px-3 text-sm lg:h-10" />
			<button type="submit" aria-label="Szukaj" disabled={!accountReady || !searchQuery.trim()} class="flex min-h-11 w-11 items-center justify-center rounded-lg border border-border-line text-sm disabled:opacity-50 lg:min-h-10 lg:w-auto lg:px-4"><MagnifyingGlass class="h-5 w-5 lg:hidden" /><span class="hidden lg:inline">Szukaj</span></button>
			<button type="button" aria-label={currentFileType !== CatalogFileType.UNSPECIFIED || currentSort.by !== 'NAME' || currentSort.direction !== 'ASC' ? 'Filtry i sortowanie, aktywne' : 'Filtry i sortowanie'} aria-expanded={showFilters} onclick={() => showFilters = !showFilters} class="min-h-11 rounded-lg border border-border-line px-3 text-sm lg:hidden">Filtry{currentFileType !== CatalogFileType.UNSPECIFIED || currentSort.by !== 'NAME' || currentSort.direction !== 'ASC' ? ' •' : ''}</button>
			{#if !searchTerm}<button type="button" aria-label={selectionMode ? 'Zamknij zaznaczanie' : 'Zaznacz elementy'} onclick={() => { if (selectionMode) clearSelection(); else selectionMode = true; }} class="min-h-11 rounded-lg border border-border-line px-3 text-sm lg:hidden">{selectionMode ? 'Gotowe' : 'Zaznacz'}</button>{/if}
			{#if searchTerm}<button type="button" onclick={closeSearch} class="rounded-lg border border-border-line px-4 text-sm">Wyczyść</button>{/if}
		</form>
		{#if searchTerm}
			<section class="rounded-md border border-border-line bg-bg-panel p-4" aria-label="Wyniki wyszukiwania">
				<h2 class="font-semibold">Wyniki wyszukiwania</h2>
				<p class="break-words text-sm text-text-muted">Wyniki dla: {searchTerm}</p>
				{#if searchError}<p role="alert">{searchError}</p>{/if}
				{#if searchBusy}<p role="status">Wyszukiwanie…</p>{/if}
				{#if !searchBusy && !searchError && !searchResults.length}<p>Brak wyników</p>{/if}
				<ul>{#each searchResults as result (result.entry?.id)}
					{#if result.entry}
					<li class="border-b border-border-line py-3">
						<button type="button" class="font-medium hover:underline" onclick={() => result.entry?.kind === EntryKind.FOLDER ? void openSearchFolder(result.entry.id) : result.entry && openFile(result.entry)}>{result.entry.name}</button>
						<div class="text-xs text-text-muted">{#if result.path.length}{#each result.path as folder, index (folder.id)}{#if index > 0} / {/if}<button type="button" class="hover:underline" onclick={() => void openSearchFolder(folder.id)}>{folder.name}</button>{/each}{:else}<button type="button" class="hover:underline" onclick={() => void openSearchFolder()}>{isSharedSpace ? 'Main' : 'Pliki prywatne'}</button>{/if}</div>
					</li>
					{/if}
				{/each}</ul>
				{#if searchNext}<button type="button" disabled={searchBusy} onclick={() => void runSearch(true)} class="mt-3 rounded border border-border-line px-4 py-2 text-sm">Pokaż więcej</button>{/if}
			</section>
		{:else}
			{#if selectionMode}<label class="inline-flex min-h-11 items-center gap-2 text-xs font-medium text-text-main lg:hidden"><input type="checkbox" class="file-selection-checkbox" checked={allLoadedSelected} indeterminate={partiallySelected} disabled={!displayedEntries.length} onchange={toggleSelectAllLoaded} aria-label="Zaznacz wszystkie wczytane elementy" />Zaznacz wszystkie wczytane</label>{/if}
			{#if selectedEntries.length}
				<div class="flex flex-wrap items-center gap-2 rounded-md border border-primary/20 bg-primary/5 p-3" role="toolbar" aria-label="Operacje dla zaznaczonych elementów">
					<strong class="mr-2 text-sm">Zaznaczono: {selectedEntries.length}</strong>
					<button type="button" onclick={() => void downloadSelected()} class="min-h-9 rounded-md border border-border-line bg-bg-panel px-3 text-xs font-medium hover:border-primary"><DownloadSimple class="mr-1 inline h-4 w-4" />Pobierz pliki</button>
					<button type="button" onclick={beginMoveSelected} class="min-h-9 rounded-md border border-border-line bg-bg-panel px-3 text-xs font-medium hover:border-primary"><Folder class="mr-1 inline h-4 w-4" />Przenieś</button>
					<button type="button" onclick={requestBulkTrash} class="min-h-9 rounded-md border border-red-200 bg-bg-panel px-3 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-900/40 dark:hover:bg-red-900/20"><Trash class="mr-1 inline h-4 w-4" />Do kosza</button>
					<button type="button" onclick={clearSelection} class="min-h-9 rounded-md px-3 text-xs font-medium text-text-muted hover:bg-gray-100 dark:hover:bg-zinc-800">Anuluj zaznaczenie</button>
				</div>
			{/if}
		{#if uploadLimitError}
 <div role="alert" class="text-sm text-red-600">Nie udało się przygotować przesyłania: {uploadLimitError} <button type="button" class="underline" onclick={() => void loadUploadLimit()}>Ponów próbę</button></div>
 {/if}
		{#if viewError}
			<div class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" role="alert">
				{viewError}
				{#if routeFolderId}<a class="ml-2 underline" href={resolve(folderHref())}>Wróć do katalogu głównego</a>{/if}
				{#if !accountReady}<button type="button" class="ml-2 font-medium underline" onclick={() => void loadAccount()}>Ponów połączenie</button>{/if}
			</div>
		{/if}
		<div class="rounded-md border border-border-line bg-bg-panel">


			<div class="hidden overflow-x-auto lg:block">
				<table class="w-full text-left text-sm">
					<thead class="border-b border-border-line bg-gray-50/50 font-medium text-text-muted dark:bg-zinc-900/50">
						<tr><th class="w-10 px-3 py-3"><input type="checkbox" class="file-selection-checkbox" checked={allLoadedSelected} indeterminate={partiallySelected} disabled={!displayedEntries.length} onchange={toggleSelectAllLoaded} aria-label="Zaznacz wszystkie wczytane elementy" /></th><th class="px-4 py-3">Nazwa</th><th class="w-36 px-4 py-3">Rozmiar</th><th class="w-40 px-4 py-3">Utworzono</th><th class="w-40 px-4 py-3">Zmodyfikowano</th><th class="w-36 px-4 py-3 text-right">Akcje</th></tr>
					</thead>
					<tbody class="divide-y divide-border-line">
						{#if folderPath.length}
								<tr class="cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50 {dropTargetId === (folderPath.length > 1 ? folderPath.at(-2)?.id : '__root__') ? 'bg-primary/10' : ''}" onclick={() => void goToBreadcrumb(folderPath.length - 2)} onkeydown={(event) => event.key === 'Enter' && void goToBreadcrumb(folderPath.length - 2)} ondragover={(event) => dragOverFolder(folderPath.length > 1 ? folderPath.at(-2) : undefined, event)} ondragleave={endFolderDrag} ondrop={(event) => void dropEntryOnFolder(folderPath.length > 1 ? folderPath.at(-2) : undefined, event)} tabindex="0" aria-label="Przejdź do folderu nadrzędnego">
								<td colspan="6" class="px-4 py-3"><button type="button" onclick={(event) => { event.stopPropagation(); void goToBreadcrumb(folderPath.length - 2); }} class="flex items-center gap-3 text-text-muted"><ArrowUp class="h-5 w-5" />{parentFolderName}</button></td>
							</tr>
						{/if}
						{#if !entries.length && !loading}
								<tr><td colspan="6" class="px-4 py-12 text-center text-text-muted"><div class="flex min-h-32 flex-col items-center justify-center gap-2"><Folder class="h-10 w-10 text-gray-300 dark:text-zinc-600" /><strong class="font-medium text-text-main">Folder jest pusty</strong><span class="text-xs">Dodaj plik albo utwórz folder, aby zacząć.</span></div></td></tr>
						{/if}
						{#each folders as entry (entry.id)}
							<tr class="group transition-colors {selectedIds.includes(entry.id) ? 'bg-primary/10 hover:bg-primary/15 dark:bg-primary/15 dark:hover:bg-primary/20' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'} {dropTargetId === entry.id ? 'bg-primary/10' : ''}" aria-selected={selectedIds.includes(entry.id)} draggable="true" ondragstart={(event) => beginEntryDrag(entry, event)} ondragover={(event) => dragOverFolder(entry, event)} ondragleave={endFolderDrag} ondrop={(event) => void dropEntryOnFolder(entry, event)} ondragend={endFolderDrag}>
								<td class="px-3 py-3"><input type="checkbox" checked={selectedIds.includes(entry.id)} onclick={(event) => changeSelection(entry, event.currentTarget.checked, event)} aria-label={`Zaznacz ${entry.name}`} class="file-selection-checkbox" /></td>
								<td class="max-w-[420px] truncate px-4 py-3 text-text-main" title={entry.name}><div class="flex items-center gap-2"><Folder class="h-5 w-5 shrink-0 fill-amber-400 text-amber-600 dark:fill-amber-500/50 dark:text-amber-400" /><button type="button" class="truncate text-left font-medium hover:underline" onclick={() => void openFolder(entry)}>{entry.name}</button></div></td>
								<td class="px-4 py-3 font-mono text-xs text-text-muted">{formatBytes(entry.sizeBytes)}</td>
								<td class="px-4 py-3 text-xs text-text-muted">{formatCreatedAt(entry.createdAt)}</td><td class="px-4 py-3 text-xs text-text-muted">{formatCreatedAt(entry.modifiedAt)}</td>
								<td class="px-4 py-3"><div class="flex items-center justify-end"><ActionMenu label={entry.name} triggerLabel={`Akcje dla ${entry.name}`} items={entryActions(entry, false)} /></div></td>
							</tr>
						{/each}
						{#each files as entry (entry.id)}
							<tr class="group transition-colors {selectedIds.includes(entry.id) ? 'bg-primary/10 hover:bg-primary/15 dark:bg-primary/15 dark:hover:bg-primary/20' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'}" aria-selected={selectedIds.includes(entry.id)} draggable="true" ondragstart={(event) => beginEntryDrag(entry, event)} ondragend={endFolderDrag}>
								<td class="px-3 py-3"><input type="checkbox" checked={selectedIds.includes(entry.id)} onclick={(event) => changeSelection(entry, event.currentTarget.checked, event)} aria-label={`Zaznacz ${entry.name}`} class="file-selection-checkbox" /></td>
								<td class="max-w-[420px] truncate px-4 py-3 text-text-main" title={entry.name}><div class="flex items-center gap-2">{#if mediaKindForFilename(entry.name) === 'IMAGE'}<FileImage class="h-5 w-5 shrink-0 text-primary" />{:else if mediaKindForFilename(entry.name) === 'AUDIO'}<FileAudio class="h-5 w-5 shrink-0 text-primary" />{:else if mediaKindForFilename(entry.name) === 'VIDEO'}<FileVideo class="h-5 w-5 shrink-0 text-primary" />{:else}<FileIcon class="h-5 w-5 shrink-0 text-primary" />{/if}<span class="min-w-0"><button type="button" class="block truncate text-left hover:underline" onclick={() => openFile(entry)} aria-label={mediaKindForFilename(entry.name) ? `Podgląd ${entry.name}` : `Pobierz ${entry.name}`}>{entry.name}</button>{#if storageLocationLabel(entry.storageLocation)}<span class="block text-xs text-text-muted">{storageLocationLabel(entry.storageLocation)}</span>{/if}</span></div></td>
								<td class="px-4 py-3 font-mono text-xs text-text-muted">{formatBytes(entry.sizeBytes)}</td>
								<td class="px-4 py-3 text-xs text-text-muted">{formatCreatedAt(entry.createdAt)}</td><td class="px-4 py-3 text-xs text-text-muted">{formatCreatedAt(entry.modifiedAt)}</td>
								<td class="px-4 py-3"><div class="flex items-center justify-end"><button type="button" onclick={() => void downloadFile(entry)} class="inline-flex h-10 w-10 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-700" aria-label={`Pobierz ${entry.name}`} title="Pobierz"><DownloadSimple class="h-4 w-4" /></button><ActionMenu label={entry.name} triggerLabel={`Akcje dla ${entry.name}`} items={entryActions(entry, false)} /></div></td>
							</tr>
						{/each}
							{#if loading}<tr><td colspan="6" class="px-4 py-4"><div class="animate-pulse space-y-3" role="status" aria-label="Ładowanie plików">{#each [1,2,3] as row (row)}<div class="h-9 rounded bg-gray-100 dark:bg-zinc-800"></div>{/each}</div></td></tr>{/if}
					</tbody>
				</table>
			</div>

			<div class="space-y-2 p-2 select-none lg:hidden">
				{#if loading}<div class="animate-pulse space-y-2" role="status" aria-label="Ładowanie plików">{#each [1,2,3] as row (row)}<div class="h-16 rounded bg-gray-100 dark:bg-zinc-800"></div>{/each}</div>{/if}
				{#if folderPath.length}
					<button type="button" onclick={() => void goToBreadcrumb(folderPath.length - 2)} ondragover={(event) => dragOverFolder(folderPath.length > 1 ? folderPath.at(-2) : undefined, event)} ondragleave={endFolderDrag} ondrop={(event) => void dropEntryOnFolder(folderPath.length > 1 ? folderPath.at(-2) : undefined, event)} class="flex w-full items-center gap-3 rounded-md border border-border-line bg-bg-panel p-3 text-left text-text-muted"><ArrowUp class="h-8 w-8 shrink-0" /><span class="truncate text-sm font-medium">{parentFolderName}</span></button>
				{/if}
				{#if !entries.length && !loading}<div class="py-10 text-center text-sm text-text-muted">Folder jest pusty</div>{/if}
				{#each [...folders, ...files] as entry (entry.id)}
					{@const isFolder = entry.kind === EntryKind.FOLDER}
					<div role="group" aria-label={entry.name} class="touch-pan-y rounded-md border {selectedIds.includes(entry.id) ? 'border-primary/50 bg-primary/10 dark:bg-primary/15' : 'border-border-line bg-bg-panel'}" onpointerdown={(event) => startLongPress(entry, event)} onpointermove={moveLongPress} onpointerup={endLongPress} onpointercancel={cancelLongPress}>
						<div class="flex items-center gap-3 p-3">
							{#if selectionMode}<label class="flex h-11 w-11 shrink-0 items-center justify-center" onpointerdown={(event) => event.stopPropagation()}><input type="checkbox" checked={selectedIds.includes(entry.id)} onclick={(event) => { event.stopPropagation(); changeSelection(entry, event.currentTarget.checked, event); }} aria-label={`Zaznacz ${entry.name}`} class="file-selection-checkbox" /></label>{/if}
							<button type="button" class="flex min-w-0 flex-1 items-center gap-3 text-left" onclick={() => openOrSelectMobile(entry)} aria-label={selectionMode ? `Zaznacz lub odznacz ${entry.name}` : isFolder ? `Otwórz folder ${entry.name}` : mediaKindForFilename(entry.name) ? `Podgląd ${entry.name}` : `Pobierz ${entry.name}`}>
								{#if isFolder}<Folder class="h-8 w-8 shrink-0 fill-amber-400 text-amber-600 dark:fill-amber-500/50 dark:text-amber-400" />{:else if mediaKindForFilename(entry.name) === 'IMAGE'}<FileImage class="h-8 w-8 shrink-0 text-primary" />{:else if mediaKindForFilename(entry.name) === 'AUDIO'}<FileAudio class="h-8 w-8 shrink-0 text-primary" />{:else if mediaKindForFilename(entry.name) === 'VIDEO'}<FileVideo class="h-8 w-8 shrink-0 text-primary" />{:else}<FileIcon class="h-8 w-8 shrink-0 text-primary" />{/if}
								<span class="min-w-0 flex-1"><span class="line-clamp-2 text-sm font-medium text-text-main">{entry.name}</span><span class="mt-0.5 block text-xs text-text-muted">{formatBytes(entry.sizeBytes)} · {formatCreatedAt(entry.modifiedAt)}</span></span>
							</button>
							<ActionMenu label={entry.name} triggerLabel={`Akcje dla ${entry.name}`} items={entryActions(entry, true)} />
						</div>
					</div>
				{/each}
			</div>

			{#if nextPageToken}
				<div class="flex justify-center border-t border-border-line p-4"><button type="button" onclick={loadNextPage} disabled={listBusy} class="rounded-md border border-border-line px-4 py-2 text-sm font-medium text-text-main hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-zinc-800">Pokaż więcej</button></div>
			{/if}
		</div>
		{/if}
	{:else}
		<div class="space-y-3">
			{#if viewError}<div class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" role="alert">{viewError}</div>{/if}
			<div class="rounded-md border border-border-line bg-bg-panel">
				<div class="flex min-h-14 flex-wrap items-center justify-between gap-3 border-b border-border-line px-4 py-3">
					<div><h2 class="text-sm font-semibold text-text-main">Usunięte elementy</h2><p class="mt-0.5 text-xs text-text-muted">Elementy w koszu można przywrócić przed upływem retencji.</p></div>
					<div class="flex items-center gap-2">
						{#if selectedTrashEntries.length}<button type="button" disabled={bulkRestoreBusy} onclick={() => void restoreSelectedTrash()} class="rounded-md border border-border-line px-3 py-2 text-xs font-medium">Przywróć zaznaczone</button><button type="button" disabled={bulkRestoreBusy} onclick={requestBulkDelete} class="rounded-md border border-red-200 px-3 py-2 text-xs font-medium text-red-600">Usuń zaznaczone trwale</button>{/if}
						<div class="inline-flex rounded-md border border-border-line p-0.5" role="group" aria-label="Przestrzeń kosza">
							<button type="button" aria-pressed={isSharedSpace} disabled={!accountReady || isSharedSpace} onclick={() => switchTrashSpace('shared')} class="rounded px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 {isSharedSpace ? 'bg-primary text-white' : 'text-text-muted hover:bg-gray-100 dark:hover:bg-zinc-800'}">Main</button>
							<button type="button" aria-pressed={!isSharedSpace} disabled={!accountReady || !isSharedSpace} onclick={() => switchTrashSpace('private')} class="rounded px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 {!isSharedSpace ? 'bg-primary text-white' : 'text-text-muted hover:bg-gray-100 dark:hover:bg-zinc-800'}">Pliki prywatne</button>
						</div>
						<button type="button" onclick={() => void refreshView()} disabled={listBusy || !activeSpaceId} class="flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-zinc-800" aria-label="Odśwież" title="Odśwież">{#if listBusy}<SpinnerGap class="h-5 w-5 animate-spin" />{:else}<ArrowClockwise class="h-5 w-5" />{/if}</button>
					</div>
				</div>
				<div class="hidden overflow-x-auto lg:block"><table class="w-full text-left text-sm"><thead class="border-b border-border-line bg-gray-50/50 font-medium text-text-muted dark:bg-zinc-900/50"><tr><th class="px-4 py-3">Nazwa</th><th class="w-36 px-4 py-3">Usunięto do</th><th class="w-48 px-4 py-3 text-right">Akcje</th></tr></thead><tbody class="divide-y divide-border-line">
					{#if !trashItems.length && !loading}<tr><td colspan="3" class="px-4 py-12 text-center text-text-muted"><div class="flex min-h-32 flex-col items-center justify-center gap-2"><Trash class="h-10 w-10 text-gray-300 dark:text-zinc-600" /><strong class="font-medium text-text-main">Kosz jest pusty</strong><span class="text-xs">Usunięte elementy pojawią się tutaj.</span></div></td></tr>{/if}
					{#each trashItems as item (item.entry?.id)}
						{#if item.entry}<tr><td class="px-4 py-3"><div class="flex items-center gap-3"><input type="checkbox" class="file-selection-checkbox" checked={selectedTrashIds.includes(item.entry.id)} aria-label={`Zaznacz ${item.entry.name}`} onchange={(event) => toggleTrashSelection(item.entry!.id, event.currentTarget.checked)} /><span class="flex h-9 w-9 items-center justify-center rounded-md bg-red-50 text-red-500 dark:bg-red-900/20"><Trash class="h-4 w-4" /></span><span><strong class="block font-medium text-text-main">{item.entry.name}</strong><span class="mt-0.5 block text-xs text-text-muted">{item.entry.kind === EntryKind.FOLDER ? 'Folder' : formatBytes(item.entry.sizeBytes)}</span></span></div></td><td class="px-4 py-3 font-mono text-xs text-text-muted">{item.purgeAt ? timestampDate(item.purgeAt).toLocaleDateString('pl-PL') : '—'}</td><td class="px-4 py-3"><div class="flex justify-end gap-2"><button type="button" disabled={pendingRestoreIds.includes(item.entry?.id ?? '')} onclick={() => void restoreTrashItem(item)} class="rounded-md border border-border-line px-3 py-2 text-xs font-medium text-text-main hover:bg-gray-50 dark:hover:bg-zinc-800">Przywróć</button><button type="button" onclick={() => void permanentlyDelete(item)} class="rounded-md px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">Zleć trwałe usunięcie</button></div></td></tr>{/if}
					{/each}
					{#if loading}<tr><td colspan="3" class="px-4 py-4"><div class="animate-pulse space-y-3" role="status" aria-label="Ładowanie kosza">{#each [1,2,3] as row (row)}<div class="h-9 rounded bg-gray-100 dark:bg-zinc-800"></div>{/each}</div></td></tr>{/if}
				</tbody></table></div>
				<div class="space-y-2 p-2 lg:hidden">
					{#if loading}<div class="animate-pulse space-y-2" role="status" aria-label="Ładowanie kosza">{#each [1,2,3] as row (row)}<div class="h-16 rounded bg-gray-100 dark:bg-zinc-800"></div>{/each}</div>{/if}
					{#if !trashItems.length && !loading}<p class="py-10 text-center text-sm text-text-muted">Kosz jest pusty</p>{/if}
					{#each trashItems as item (item.entry?.id)}
						{#if item.entry}<div class="rounded-md border border-border-line p-3"><div class="flex items-center gap-3"><input type="checkbox" class="file-selection-checkbox" checked={selectedTrashIds.includes(item.entry.id)} aria-label={`Zaznacz ${item.entry.name}`} onchange={(event) => toggleTrashSelection(item.entry!.id, event.currentTarget.checked)} /><span class="flex h-9 w-9 items-center justify-center rounded-md bg-red-50 text-red-500 dark:bg-red-900/20"><Trash class="h-4 w-4" /></span><span class="min-w-0 flex-1"><strong class="block truncate text-sm font-medium text-text-main">{item.entry.name}</strong><span class="mt-0.5 block text-xs text-text-muted">{item.purgeAt ? `Do ${timestampDate(item.purgeAt).toLocaleDateString('pl-PL')}` : 'Termin usunięcia nieznany'}</span></span></div><div class="mt-3 flex justify-end gap-2"><button type="button" disabled={pendingRestoreIds.includes(item.entry?.id ?? '')} onclick={() => void restoreTrashItem(item)} class="rounded-md border border-border-line px-3 py-2 text-xs font-medium">Przywróć</button><button type="button" onclick={() => void permanentlyDelete(item)} class="rounded-md px-3 py-2 text-xs font-medium text-red-600">Zleć trwałe usunięcie</button></div></div>{/if}
					{/each}
				</div>
				{#if nextPageToken}<div class="flex justify-center border-t border-border-line p-4"><button type="button" onclick={loadNextPage} disabled={listBusy} class="rounded-md border border-border-line px-4 py-2 text-sm font-medium text-text-main hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-zinc-800">Pokaż więcej</button></div>{/if}
			</div>
		</div>
	{/if}

</div>

{#if previewEntry && activeSpaceId}
	<FilePreviewDialog
		file={previewEntry}
		spaceId={activeSpaceId}
		onclose={() => (previewEntry = null)}
		ondownload={() => {
			if (previewEntry) void downloadFile(previewEntry);
		}}
	/>
{/if}

{#if sharingEntry && activeSpaceId}
	<ShareLinksDialog file={sharingEntry} spaceId={activeSpaceId} onclose={() => (sharingEntry = null)} />
{/if}
{#if detailsEntry}
	<EntryDetailsDialog entry={detailsEntry} path={[isSharedSpace ? 'Pliki wspólne' : 'Pliki prywatne', ...folderPath.map(folder => folder.name)].join(' / ')} onclose={() => detailsEntry = null} />
{/if}

{#if restoreConflict}
	<AppDialog labelledby="restore-conflict-title" onclose={() => restoreConflict = null}>
		<h2 id="restore-conflict-title" class="text-base font-semibold">Element o tej nazwie już istnieje</h2>
		<p class="mt-2 break-words text-sm text-text-muted">Przywróć jako „{restoreConflict.name}” lub pomiń ten element.</p>
		<div class="mt-5 flex flex-wrap justify-end gap-2">
			<button type="button" class="min-h-10 rounded-md px-3 text-sm" onclick={() => restoreConflict = null}>Pomiń</button>
			<button type="button" class="min-h-10 rounded-md border border-border-line px-3 text-sm" onclick={() => { const choice = restoreConflict; restoreConflict = null; if (choice && currentList?.spaceId === choice.spaceId) void restoreTrashItem(choice.item, choice.name); }}>Zachowaj oba</button>
			{#if restoreConflict.target}<button type="button" class="min-h-10 rounded-md bg-red-600 px-3 text-sm text-white" onclick={() => { const choice = restoreConflict; restoreConflict = null; if (choice && currentList?.spaceId === choice.spaceId) void restoreTrashItem(choice.item, undefined, choice.target); }}>Zastąp</button>{/if}
		</div>
	</AppDialog>
{/if}

{#if uploadConflict}
	<AppDialog labelledby="upload-conflict-title" onclose={() => chooseUploadConflict('skip')}>
		<h2 id="upload-conflict-title" class="text-base font-semibold">Element o tej nazwie już istnieje</h2>
		<p class="mt-2 break-words text-sm text-text-muted">{uploadConflict.name}</p>
		<div class="mt-5 flex flex-wrap justify-end gap-2">
			<button type="button" class="min-h-10 rounded-md px-3 text-sm" onclick={() => chooseUploadConflict('skip')}>Pomiń</button>
			<button type="button" class="min-h-10 rounded-md border border-border-line px-3 text-sm" onclick={() => chooseUploadConflict('keep')}>Zachowaj oba</button>
			{#if uploadConflict.canReplace}<button type="button" class="min-h-10 rounded-md bg-red-600 px-3 text-sm text-white" onclick={() => chooseUploadConflict('replace')}>Zastąp</button>{/if}
		</div>
	</AppDialog>
{/if}

{#if bulkTrashOpen}
	<AppDialog labelledby="bulk-trash-title" busy={bulkTrashBusy} onclose={() => { if (!bulkTrashBusy) bulkTrashOpen = false; }}>
		<section class="space-y-4">
			<div><h2 id="bulk-trash-title" class="text-base font-semibold text-text-main">Przenieść zaznaczone elementy do kosza?</h2><p class="mt-2 text-sm text-text-muted">Operacja obejmie {bulkTrashTarget.length || selectedEntries.length} elementów. Foldery pozostaną w całości w koszu.</p></div>
			{#if trashError}<p class="rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300" role="alert">{trashError}</p>{/if}
			{#if bulkTrashResults.length}<ul class="max-h-48 space-y-1 overflow-y-auto rounded border border-border-line p-3 text-sm">{#each bulkTrashResults as result (result.entry.id)}<li class="flex items-start justify-between gap-3"><span class="min-w-0 truncate">{result.entry.name}</span>{#if result.error}<span class="shrink-0 text-xs text-red-600">Niepowodzenie: {result.error}</span>{:else}<span class="shrink-0 text-xs text-emerald-700">W koszu</span>{/if}</li>{/each}</ul>{/if}
			<div class="flex flex-wrap justify-end gap-2 border-t border-border-line pt-3"><button type="button" disabled={bulkTrashBusy} onclick={() => (bulkTrashOpen = false)} class="min-h-10 rounded-md px-3 text-sm text-text-muted hover:bg-gray-100 dark:hover:bg-zinc-800">Zamknij</button><button type="button" disabled={bulkTrashBusy || !bulkTrashTarget.length} onclick={() => void trashSelected()} class="inline-flex min-h-10 items-center gap-2 rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">{#if bulkTrashBusy}<SpinnerGap class="h-4 w-4 animate-spin" />{/if}{bulkTrashResults.some((result) => result.error) ? 'Ponów nieudane' : 'Przenieś do kosza'}</button></div>
		</section>
	</AppDialog>
{/if}

{#if bulkDeleteOpen}
	<AppDialog labelledby="bulk-delete-title" busy={bulkDeleteBusy} onclose={() => { if (!bulkDeleteBusy) bulkDeleteOpen = false; }}>
		<section class="space-y-4">
			<h2 id="bulk-delete-title" class="text-base font-semibold text-text-main">Trwale usunąć zaznaczone elementy?</h2>
			<p class="text-sm text-text-muted">Zlecenie obejmuje {bulkDeleteBatches.reduce((count, batch) => count + batch.entries.length, 0)} elementów wraz z zawartością folderów.</p>
			{#if bulkDeleteError}<p role="alert" class="rounded-md bg-red-500/10 p-3 text-sm text-red-600">{bulkDeleteError}</p>{/if}
			<div class="flex justify-end gap-2"><button type="button" disabled={bulkDeleteBusy} onclick={() => (bulkDeleteOpen = false)} class="min-h-10 rounded-md px-3 text-sm">Zamknij</button><button type="button" disabled={bulkDeleteBusy} onclick={() => void confirmBulkDelete()} class="min-h-10 rounded-md bg-red-600 px-4 text-sm font-medium text-white">Zleć trwałe usunięcie</button></div>
		</section>
	</AppDialog>
{/if}

{#if movingEntry && activeSpaceId}
	<MoveEntryDialog
		entry={movingEntry}
		entries={movingEntries}
		spaceId={activeSpaceId}
		{spaces}
		initialPath={folderPath}
		onclose={() => (movingEntry = null)}
		onmoved={(moved, failed) => {
			for (const entry of moved) app.entryMoved(activeSpaceId, entry, movingEntries.find((item) => item.id === entry.id)?.parentId ?? movingEntry?.parentId ?? '');
			if (failed.length) {
				selectedIds = failed.map((entry) => entry.id);
				movingEntries = failed;
				movingEntry = failed[0];
				apiError = `Przeniesiono ${moved.length}; nie udało się przenieść ${failed.length}.`;
			} else {
				movingEntry = null;
				movingEntries = [];
				selectedIds = [];
				notice = moved.length > 1 ? `Przeniesiono ${moved.length} elementów.` : 'Element został przeniesiony.';
			}
		}}
	/>
{/if}

{#if showCreateFolder}
	<AppDialog labelledby="create-folder-title" busy={folderBusy} onclose={()=>showCreateFolder=false}>
			<form onsubmit={(event) => { event.preventDefault(); void createFolder(); }} class="space-y-4">
				<h2 id="create-folder-title" class="text-base font-semibold text-text-main">Nowy folder</h2>
				<label class="block space-y-1.5 text-sm text-text-main"><span>Nazwa</span><input bind:value={folderName} placeholder="Nazwa folderu" required disabled={folderBusy || Boolean(pendingFolderRequest)} class="w-full rounded-md border border-border-line bg-bg-app px-3 py-2 text-sm text-text-main focus:border-primary focus:outline-none" /></label>
				{#if folderError}<div class="rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300" role="alert">{folderError}{#if pendingFolderRequest}<p class="mt-1 text-xs">Ponowienie użyje tego samego identyfikatora żądania.</p>{/if}</div>{/if}
				<div class="flex justify-end gap-2 pt-2"><button type="button" disabled={folderBusy} onclick={() => (showCreateFolder = false)} class="rounded-md px-3 py-2 text-sm text-text-muted hover:bg-gray-100 dark:hover:bg-zinc-800">Anuluj</button><button type="submit" disabled={folderBusy || (!folderName.trim() && !pendingFolderRequest)} class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">{pendingFolderRequest ? 'Ponów' : 'Utwórz'}</button></div>
			</form>
	</AppDialog>
{/if}

{#if pendingTrashEntry}
	<AppDialog labelledby="trash-entry-title" describedby="trash-entry-description" alert busy={trashRequestPending} onclose={()=>pendingTrashEntry=null}>
		<section class="space-y-4">
			<div>
				<h2 id="trash-entry-title" class="text-base font-semibold text-text-main">Przenieść do kosza?</h2>
				<p id="trash-entry-description" class="mt-2 break-words text-sm text-text-muted">Element „{pendingTrashEntry.name}” będzie można później przywrócić.</p>
			</div>
			{#if trashError}<p class="rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300" role="alert">{trashError}</p>{/if}
			<div class="flex justify-end gap-2 pt-2">
				<button type="button" onclick={() => (pendingTrashEntry = null)} disabled={trashRequestPending} class="rounded-md px-3 py-2 text-sm text-text-muted hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-zinc-800">Anuluj</button>
				<button type="button" onclick={() => void moveToTrash()} disabled={trashRequestPending} class="inline-flex items-center gap-2 rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
					{#if trashRequestPending}<SpinnerGap class="h-4 w-4 animate-spin" />Przenoszenie…{:else}Przenieś do kosza{/if}
				</button>
			</div>
		</section>
	</AppDialog>
{/if}

{#if renamingEntry}
	<AppDialog labelledby="rename-entry-title" busy={renameBusy} onclose={()=>renamingEntry=null}>
			<form onsubmit={saveRename} class="space-y-4">
				<h2 id="rename-entry-title" class="text-base font-semibold text-text-main">Zmień nazwę</h2>
				<label class="block space-y-1.5 text-sm text-text-main"><span>Nazwa</span><input bind:value={renameValue} disabled={renameBusy} required class="w-full rounded-md border border-border-line bg-bg-app px-3 py-2 text-sm text-text-main focus:border-primary focus:outline-none" /></label>
				{#if viewError}<p class="rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300" role="alert">{viewError}</p>{/if}
				<div class="flex justify-end gap-2 pt-2"><button type="button" disabled={renameBusy} onclick={() => (renamingEntry = null)} class="rounded-md px-3 py-2 text-sm text-text-muted hover:bg-gray-100 dark:hover:bg-zinc-800">Anuluj</button><button type="submit" disabled={renameBusy || !renameValue.trim()} class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">Zapisz</button></div>
			</form>
	</AppDialog>
{/if}

{#if pendingDelete?.entry}
 <AppDialog labelledby="delete-title" describedby="delete-description" alert busy={deletePending} onclose={()=>pendingDelete=null}>
  <h2 id="delete-title" class="text-base font-semibold">Zlecić trwałe usunięcie?</h2>
  <p id="delete-description" class="mt-3 break-words text-sm text-text-muted">Elementu „{pendingDelete.entry.name}” nie będzie można przywrócić.</p>
  {#if deleteError}<p class="mt-3 text-sm text-red-600" role="alert">{deleteError}</p>{/if}
  <div class="mt-5 flex justify-end gap-2"><button type="button" disabled={deletePending} class="rounded px-3 py-2 text-sm" onclick={()=>pendingDelete=null}>Anuluj</button><button type="button" disabled={deletePending} class="rounded bg-red-600 px-3 py-2 text-sm text-white" onclick={()=>void confirmDelete()}>{deletePending?'Usuwanie…':'Zleć trwałe usunięcie'}</button></div>
 </AppDialog>
{/if}
