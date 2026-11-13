import { getContext } from 'svelte';
import { SvelteMap, SvelteSet } from 'svelte/reactivity';
import { create } from '@bufbuild/protobuf';
import { catalog, identity, multipartUploads, storageSettings, trash } from './api.js';
import {
	CatalogFileType,
	CatalogSortBy as CatalogSortByEnum,
	CatalogSortDirection as CatalogSortDirectionEnum,
	EntryKind,
	GetEntryRequestSchema,
	GetSpacesRequestSchema,
	ListEntriesRequestSchema,
	ListTrashRequestSchema,
	type Entry,
	type Space,
	type TrashItem
} from './gen/unisourcecfl/catalog/v1/catalog_pb.js';
import { GetMeRequestSchema } from './gen/unisourcecfl/identity/v1/identity_pb.js';
import {
	type StorageSettings,
	GetUploadLimitsRequestSchema
} from './gen/unisourcecfl/storage/v1/storage_pb.js';
import { UploadMode } from './gen/unisourcecfl/upload/v1/upload_pb.js';
import { MultipartController, type MultipartControllerOptions } from './multipart/controller.js';
import { IndexedDbMultipartSessionStore, type MultipartSessionStore } from './multipart/session-store.js';
import type { MultipartCapabilities } from './multipart/protocol.js';
import { MAX_UPLOAD_BYTES } from './upload.js';
import { storageErrorMessage } from './storage-error.js';
import { UploadManager } from './upload-manager.svelte.js';

export const CLOUD_CONTEXT = Symbol('cloud-state');
const FRESH_MS = 15 * 60_000;
export type CatalogSortBy = 'NAME' | 'CREATED_AT' | 'SIZE' | 'MODIFIED_AT';
export type CatalogSortDirection = 'ASC' | 'DESC';
export type CatalogSort = { by: CatalogSortBy; direction: CatalogSortDirection };
const DEFAULT_SORT: CatalogSort = { by: 'NAME', direction: 'ASC' };
const SORT_BY_PROTO = {
	NAME: CatalogSortByEnum.NAME,
	CREATED_AT: CatalogSortByEnum.CREATED_AT,
	MODIFIED_AT: CatalogSortByEnum.MODIFIED_AT,
	SIZE: CatalogSortByEnum.SIZE
} satisfies Record<CatalogSortBy, CatalogSortByEnum>;
const SORT_DIRECTION_PROTO = {
	ASC: CatalogSortDirectionEnum.ASC,
	DESC: CatalogSortDirectionEnum.DESC
} satisfies Record<CatalogSortDirection, CatalogSortDirectionEnum>;
export type CloudStateOptions = {
	multipart?: Partial<Pick<MultipartControllerOptions, 'rpc' | 'store' | 'hash' | 'put' | 'isOnline' | 'id'>> & {
		store?: MultipartSessionStore;
	};
};
export class CatalogList {
	entries = $state<Entry[]>([]);
	items = $state<TrashItem[]>([]);
	path = $state<Entry[]>([]);
	nextPageToken = $state('');
	initialized = $state(false);
	loading = $state(false);
	refreshing = $state(false);
	loadingNext = $state(false);
	error = $state('');
	errorKind = $state<'load' | 'next' | null>(null);
	scrollTop = 0;
	pages = 0;
	updatedAt = 0;
	dirty = true;
	version = 0;
	pending?: Promise<void>;
	constructor(
		readonly mode: 'files' | 'trash',
		readonly spaceId: string,
		readonly parentId: string,
		readonly sort: CatalogSort,
		readonly fileType: CatalogFileType
	) {}
	get key(): string {
		return JSON.stringify([this.mode, this.spaceId, this.parentId, this.sort.by, this.sort.direction, this.fileType]);
	}
}

export class CloudState {
	spaces = $state<Space[]>([]);
	accountReady = $state(false);
	accountLoading = $state(false);
	accountError = $state('');
	uploadLimitBytes = $state<bigint | null>(null);
	uploadLimitError = $state('');
	uploadLimitLoading = $state(false);
	canManageSettings = $state(false);
	multipartCapabilities = $state<MultipartCapabilities | undefined>(undefined);
	defaultUploadMode = $state(UploadMode.AUTO);
	trashSpaceId = $state('');
	lastFolders = $state<Record<string, string>>({});
	sortsBySpace = $state<Record<string, CatalogSort>>({});
	fileTypesBySpace = $state<Record<string, CatalogFileType>>({});
	activeListKey = $state('');
	userId = '';
	sessionId = '';
	adminSettings = $state.raw<StorageSettings | null>(null);
	settingsDraft: { uploadMb: string; r2Gb: string; rustfsGb: string } | null = null;
	get sessionVersion(): number {
		return this.generation;
	}
	get activeList(): CatalogList | undefined {
		return this.lists.get(this.activeListKey);
	}
	private generation = 0;
	private accountPromise?: Promise<void>;
	private limitsPromise?: Promise<void>;
	private limitsUpdatedAt = 0;
	private lists = new SvelteMap<string, CatalogList>();
	private readonly multipartController: MultipartController;
	readonly transfers: UploadManager;
	constructor(options: CloudStateOptions = {}) {
		this.multipartController = new MultipartController({
			ownerId: 'signed-out',
			rpc: options.multipart?.rpc ?? multipartUploads,
			store: options.multipart?.store ?? new IndexedDbMultipartSessionStore(),
			...(options.multipart?.hash ? { hash: options.multipart.hash } : {}),
			...(options.multipart?.put ? { put: options.multipart.put } : {}),
			...(options.multipart?.isOnline ? { isOnline: options.multipart.isOnline } : {}),
			...(options.multipart?.id ? { id: options.multipart.id } : {})
		});
		this.transfers = new UploadManager(
			(target) => this.changed(target.spaceId, target.parentId ?? ''),
			this.multipartController
		);
	}

	activate(userId: string, sessionId = userId): void {
		if (this.userId === userId && this.sessionId === sessionId) return;
		this.reset();
		this.userId = userId;
		this.sessionId = sessionId;
		this.transfers.setAccountId(userId);
		if (userId && typeof localStorage !== 'undefined') {
			try {
				const value = Number(localStorage.getItem(`unisource-cloud:${userId}:upload-mode`));
				if ([UploadMode.AUTO, UploadMode.R2, UploadMode.RUSTFS].includes(value))
					this.defaultUploadMode = value;
			} catch {
				/* Preferences are optional when storage is unavailable. */
			}
		}
	}
	reset(): void {
		this.generation++;
		this.transfers.reset();
		this.multipartController.setAccountId('signed-out');
		this.multipartCapabilities = undefined;
		this.transfers.setMultipartCapabilities(undefined);
		this.lists.clear();
		this.accountPromise = undefined;
		this.limitsPromise = undefined;
		this.limitsUpdatedAt = 0;
		this.spaces = [];
		this.accountReady = false;
		this.accountLoading = false;
		this.accountError = '';
		this.uploadLimitBytes = null;
		this.uploadLimitError = '';
		this.uploadLimitLoading = false;
		this.canManageSettings = false;
		this.defaultUploadMode = UploadMode.AUTO;
		this.trashSpaceId = '';
		this.lastFolders = {};
		this.sortsBySpace = {};
		this.fileTypesBySpace = {};
		this.activeListKey = '';
		this.userId = '';
		this.sessionId = '';
		this.adminSettings = null;
		this.settingsDraft = null;
	}
	setDefaultUploadMode(mode: UploadMode): void {
		if (![UploadMode.AUTO, UploadMode.R2, UploadMode.RUSTFS].includes(mode)) return;
		this.defaultUploadMode = mode;
		try {
			if (this.userId)
				localStorage.setItem(`unisource-cloud:${this.userId}:upload-mode`, String(mode));
		} catch {
			/* Keep the in-memory preference. */
		}
	}
	async ensureAccount(): Promise<void> {
		if (this.accountReady) return;
		if (this.accountPromise) return this.accountPromise;
		const generation = this.generation;
		this.accountLoading = true;
		this.accountError = '';
		this.accountPromise = (async () => {
			try {
				const [, result] = await Promise.all([
					identity.getMe(create(GetMeRequestSchema)),
					catalog.getSpaces(create(GetSpacesRequestSchema))
				]);
				if (generation !== this.generation) return;
				this.spaces = result.spaces;
				this.accountReady = true;
			} catch (error) {
				if (generation === this.generation) this.accountError = storageErrorMessage(error);
			} finally {
				if (generation === this.generation) {
					this.accountLoading = false;
					this.accountPromise = undefined;
				}
			}
		})();
		return this.accountPromise;
	}
	async loadUploadLimit(force = false): Promise<void> {
		if (this.limitsPromise) return this.limitsPromise;
		if (this.uploadLimitBytes !== null && !force && Date.now() - this.limitsUpdatedAt < FRESH_MS)
			return;
		const generation = this.generation;
		this.uploadLimitLoading = true;
		this.uploadLimitError = '';
		this.limitsPromise = (async () => {
			try {
				const result = await storageSettings.getUploadLimits(create(GetUploadLimitsRequestSchema));
				if (generation !== this.generation) return;
				if (result.maxUploadBytes < 0n || result.maxUploadBytes > BigInt(MAX_UPLOAD_BYTES))
					throw new Error('Backend zwrócił nieprawidłowy limit przesyłania.');
				this.uploadLimitBytes = result.maxUploadBytes;
				this.multipartCapabilities = result.multipart;
				this.transfers.setMultipartCapabilities(result.multipart);
				this.limitsUpdatedAt = Date.now();
				this.canManageSettings = result.canManage;
			} catch (error) {
				if (generation === this.generation) {
					this.uploadLimitError = storageErrorMessage(error);
				}
			} finally {
				if (generation === this.generation) {
					this.uploadLimitLoading = false;
					this.limitsPromise = undefined;
				}
			}
		})();
		return this.limitsPromise;
	}
	sortFor(spaceId: string): CatalogSort {
		return this.sortsBySpace[spaceId] ?? DEFAULT_SORT;
	}
	setSort(spaceId: string, sort: CatalogSort): void {
		if (!spaceId || !['NAME', 'CREATED_AT', 'SIZE', 'MODIFIED_AT'].includes(sort.by) || !['ASC', 'DESC'].includes(sort.direction)) return;
		const current = this.sortFor(spaceId);
		if (current.by === sort.by && current.direction === sort.direction) return;
		const active = this.activeList;
		this.sortsBySpace = { ...this.sortsBySpace, [spaceId]: { ...sort } };
		for (const list of this.lists.values()) {
			if (list.mode !== 'files' || list.spaceId !== spaceId) continue;
			list.version++;
			list.entries = [];
			list.nextPageToken = '';
			list.pages = 0;
			list.scrollTop = 0;
			list.initialized = false;
			list.dirty = true;
			list.updatedAt = 0;
			list.error = '';
			list.errorKind = null;
		}
		if (active?.mode === 'files' && active.spaceId === spaceId)
			this.activeListKey = this.list('files', spaceId, active.parentId, sort).key;
	}
	fileTypeFor(spaceId: string): CatalogFileType {
		return this.fileTypesBySpace[spaceId] ?? CatalogFileType.UNSPECIFIED;
	}
	setFileType(spaceId: string, fileType: CatalogFileType): void {
		if (!spaceId || !Number.isInteger(fileType) || fileType < 0 || fileType > 6 || this.fileTypeFor(spaceId) === fileType) return;
		const active = this.activeList;
		this.fileTypesBySpace = { ...this.fileTypesBySpace, [spaceId]: fileType };
		for (const list of this.lists.values()) {
			if (list.mode !== 'files' || list.spaceId !== spaceId) continue;
			list.version++;
			list.dirty = true;
		}
		if (active?.mode === 'files' && active.spaceId === spaceId)
			this.activeListKey = this.list('files', spaceId, active.parentId, active.sort, fileType).key;
	}
	peekList(
		mode: 'files' | 'trash',
		spaceId: string,
		parentId: string,
		sort: CatalogSort = mode === 'files' ? this.sortFor(spaceId) : DEFAULT_SORT,
		fileType: CatalogFileType = mode === 'files' ? this.fileTypeFor(spaceId) : CatalogFileType.UNSPECIFIED
	): CatalogList | undefined {
		return this.lists.get(JSON.stringify([mode, spaceId, parentId, sort.by, sort.direction, fileType]));
	}
	list(
		mode: 'files' | 'trash',
		spaceId: string,
		parentId: string,
		sort: CatalogSort = mode === 'files' ? this.sortFor(spaceId) : DEFAULT_SORT,
		fileType: CatalogFileType = mode === 'files' ? this.fileTypeFor(spaceId) : CatalogFileType.UNSPECIFIED
	): CatalogList {
		const key = JSON.stringify([mode, spaceId, parentId, sort.by, sort.direction, fileType]);
		let list = this.lists.get(key);
		if (!list) {
			list = new CatalogList(mode, spaceId, parentId, sort, fileType);
			this.lists.set(key, list);
		}
		return list;
	}
	async load(list: CatalogList, options: { force?: boolean; next?: boolean } = {}): Promise<void> {
		if (list.pending) return list.pending;
		if (options.next && !list.nextPageToken) return;
		if (!options.force && !options.next && !list.dirty && Date.now() - list.updatedAt < FRESH_MS)
			return;
		const generation = this.generation,
			version = list.version;
		const current = () => generation === this.generation && version === list.version;
		list.loading = !list.initialized;
		list.refreshing = list.initialized && !options.next;
		list.loadingNext = !!options.next;
		list.error = '';
		list.errorKind = null;
		list.pending = (async () => {
			try {
				let path = list.path;
				if (list.mode === 'files' && list.parentId && (list.dirty || !list.initialized))
					path = await this.folderPath(list.spaceId, list.parentId);
				let token = options.next ? list.nextPageToken : '';
				const pages = options.next ? 1 : Math.max(1, list.pages);
				const entries: Entry[] = [],
					items: TrashItem[] = [];
				let loaded = 0;
				do {
					if (!current()) return;
					if (list.mode === 'files') {
						const result = await catalog.listEntries(
							create(ListEntriesRequestSchema, {
								spaceId: list.spaceId,
								...(list.parentId ? { parentId: list.parentId } : {}),
								pageSize: 50,
								pageToken: token,
								sortBy: SORT_BY_PROTO[list.sort.by],
								sortDirection: SORT_DIRECTION_PROTO[list.sort.direction],
								fileType: list.fileType
							})
						);
						entries.push(...result.entries);
						token = result.nextPageToken;
					} else {
						const result = await trash.listTrash(
							create(ListTrashRequestSchema, {
								spaceId: list.spaceId,
								pageSize: 50,
								pageToken: token
							})
						);
						items.push(...result.items);
						token = result.nextPageToken;
					}
					loaded++;
				} while (token && loaded < pages);
				if (!current()) return;
				list.entries = uniqueEntries(options.next ? [...list.entries, ...entries] : entries);
				list.items = Array.from(
					new SvelteMap(
						(options.next ? [...list.items, ...items] : items).map((item) => [item.entry?.id, item])
					).values()
				);
				list.path = path;
				list.nextPageToken = token;
				list.pages = options.next ? list.pages + loaded : loaded;
				list.initialized = true;
				list.dirty = false;
				list.updatedAt = Date.now();
			} catch (error) {
				if (current()) { list.error = storageErrorMessage(error); list.errorKind = options.next ? 'next' : 'load'; }
			} finally {
				list.loading = false;
				list.refreshing = false;
				list.loadingNext = false;
				list.pending = undefined;
				// A mutation may invalidate this response while it is in flight.
				if (
					generation === this.generation &&
					version !== list.version &&
					this.activeListKey === list.key
				)
					void this.load(list, { force: true });
			}
		})();
		return list.pending;
	}
	private async folderPath(spaceId: string, folderId: string): Promise<Entry[]> {
		const path: Entry[] = [],
			visited = new SvelteSet<string>();
		let id = folderId;
		while (id) {
			if (visited.has(id) || visited.size >= 100) throw new Error('Nieprawidłowa ścieżka folderu.');
			visited.add(id);
			const cached = Array.from(this.lists.values())
				.filter(
					(list) =>
						list.spaceId === spaceId &&
						list.mode === 'files' &&
						!list.dirty &&
						Date.now() - list.updatedAt < FRESH_MS
				)
				.flatMap((list) => [...list.entries, ...list.path])
				.find((entry) => entry.id === id);
			const entry =
				cached ??
				(await catalog.getEntry(create(GetEntryRequestSchema, { spaceId, entryId: id }))).entry;
			if (!entry || entry.kind !== EntryKind.FOLDER || entry.spaceId !== spaceId)
				throw new Error('Nie znaleziono folderu. Wróć do katalogu głównego.');
			path.unshift(entry);
			id = entry.parentId ?? '';
		}
		return path;
	}
	changed(spaceId: string, parentId: string, entry?: Entry, removedId?: string): void {
		// Restores can target an unvisited parent; its ancestors are then unknown.
		const unknownAncestors = !!parentId && !this.peekList('files', spaceId, parentId)?.initialized;
		for (const list of this.lists.values()) {
			if (list.spaceId !== spaceId) continue;
			if (
				list.mode === 'files' &&
				list.parentId !== parentId &&
				!unknownAncestors &&
				!list.entries.some(
					(folder) =>
						folder.kind === EntryKind.FOLDER &&
						(folder.id === parentId ||
							this.peekList('files', spaceId, parentId)?.path.some(
								(ancestor) => ancestor.id === folder.id
							))
				) &&
				!list.path.some((folder) => folder.id === removedId || folder.id === entry?.id)
			)
				continue;
			list.version++;
			list.dirty = true;
			if (list.mode === 'files' && list.parentId === parentId) {
				if (removedId) list.entries = list.entries.filter((item) => item.id !== removedId);
				if (entry && list.fileType === CatalogFileType.UNSPECIFIED)
					list.entries = uniqueEntries([
						...list.entries.filter((item) => item.id !== entry.id),
						entry
					]);
			}
			if (list.key === this.activeListKey) void this.load(list, { force: true });
		}
	}
	entryMoved(spaceId: string, entry: Entry, oldParentId: string): void {
		this.changed(spaceId, oldParentId, undefined, entry.id);
		this.changed(entry.spaceId, entry.parentId ?? '');
	}
	revalidateActive(): void {
		const list = this.lists.get(this.activeListKey);
		if (list) void this.load(list);
	}
}
function uniqueEntries(entries: Entry[]): Entry[] {
	return Array.from(new SvelteMap(entries.map((entry) => [entry.id, entry])).values());
}
export function getCloudState(): CloudState {
	const state = getContext<CloudState | undefined>(CLOUD_CONTEXT);
	if (!state) throw new Error('CloudState provider is required.');
	return state;
}
