<script lang="ts">
	import { create } from '@bufbuild/protobuf';
	import { onMount } from 'svelte';
	import { catalog } from '#lib/api.js';
	import { storageErrorMessage } from '#lib/storage-error.js';
	import {
		EntryKind,
		SpaceKind,
		ListEntriesRequestSchema,
		MoveEntryRequestSchema,
		BulkMoveEntriesRequestSchema,
		EntrySchema,
		type Entry,
		type Space
	} from '#lib/gen/unisourcecfl/catalog/v1/catalog_pb.js';
	import AppDialog from './AppDialog.svelte';
	import { ArrowLeft, CaretRight, Folder, SpinnerGap } from 'phosphor-svelte';

	let {
		entry,
		entries = [],
		spaceId,
		spaces,
		initialPath,
		onclose,
		onmoved
	}: {
		entry: Entry;
		entries?: Entry[];
		spaceId: string;
		spaces: Space[];
		initialPath: Entry[];
		onclose: () => void;
		onmoved: (moved: Entry[], failed: Entry[]) => void;
	} = $props();
	const moveEntries = $derived(entries.length ? entries : [entry]);

	let targetSpaceId = $state('');
	let path = $state<Entry[]>([]);
	let folders = $state<Entry[]>([]);
	let nextPageToken = $state('');
	let loading = $state(false);
	let busy = $state(false);
	let error = $state('');
	let loadVersion = 0;
	let bulkBatches: { entries: Entry[]; requestId: string; parent: string; targetSpaceId: string }[] = [];
	const parentId = $derived(path.at(-1)?.id ?? '');
	const targetIsSource = $derived(targetSpaceId === spaceId && moveEntries.every((item) => parentId === (item.parentId ?? '')));
	const sourceAlreadyAtRoot = $derived(targetSpaceId === spaceId && moveEntries.every((item) => !(item.parentId ?? '')));
	const targetIsInsideSource = $derived(
		targetSpaceId === spaceId && moveEntries.some((item) => item.kind === EntryKind.FOLDER && path.some((folder) => folder.id === item.id))
	);

	onMount(() => {
		targetSpaceId = spaceId;
		path = [...initialPath];
		void loadFolders(false);
	});

	async function loadFolders(next: boolean): Promise<void> {
		if (loading || (next && !nextPageToken)) return;
		loading = true;
		error = '';
		const version = ++loadVersion;
		try {
			const result = await catalog.listEntries(
				create(ListEntriesRequestSchema, {
					spaceId: targetSpaceId,
					...(parentId ? { parentId } : {}),
					pageSize: 50,
					pageToken: next ? nextPageToken : ''
				})
			);
			if (version !== loadVersion) return;
			const sourceIds = new Set(moveEntries.map((item) => item.id));
			const visibleFolders = result.entries.filter(
				(item) => item.kind === EntryKind.FOLDER && !sourceIds.has(item.id)
			);
			folders = next ? [...folders, ...visibleFolders] : visibleFolders;
			nextPageToken = result.nextPageToken;
		} catch (cause) {
			if (version === loadVersion) error = storageErrorMessage(cause);
		} finally {
			if (version === loadVersion) loading = false;
		}
	}

	function switchSpace(value: string): void {
		if (busy || !spaces.some((space) => space.id === value)) return;
		loadVersion++;
		loading = false;
		targetSpaceId = value;
		path = [];
		folders = [];
		nextPageToken = '';
		void loadFolders(false);
	}

	function openFolder(folder: Entry): void {
		if (busy) return;
		loadVersion++;
		loading = false;
		path = [...path, folder];
		folders = [];
		nextPageToken = '';
		void loadFolders(false);
	}

	function goTo(index: number): void {
		if (busy) return;
		loadVersion++;
		loading = false;
		path = index < 0 ? [] : path.slice(0, index + 1);
		folders = [];
		nextPageToken = '';
		void loadFolders(false);
	}

	async function moveTo(parent: string): Promise<void> {
		const parentIsSource = targetSpaceId === spaceId && moveEntries.every((item) => parent === (item.parentId ?? ''));
		const destinationIsInsideSource = Boolean(parent) && targetIsInsideSource;
		if (busy || destinationIsInsideSource || parentIsSource) return;
		busy = true;
		error = '';
		const moved: Entry[] = [];
		const failed: Entry[] = [];
		let firstFailure: unknown;
		let nextIndex = 0;
		const pending = moveEntries.filter((item) => targetSpaceId !== spaceId || (item.parentId ?? '') !== parent);
		if (pending.length > 1 || bulkBatches.length) {
			const selectedKey = JSON.stringify(pending.map((item) => [item.id, item.revision]));
			const pendingKey = JSON.stringify(bulkBatches.flatMap((batch) => batch.entries.map((item) => [item.id, item.revision])));
			if (selectedKey !== pendingKey || bulkBatches.some((batch) => batch.parent !== parent || batch.targetSpaceId !== targetSpaceId)) {
				bulkBatches = [];
				for (let i = 0; i < pending.length; i += 100) bulkBatches.push({ entries: pending.slice(i, i + 100), requestId: crypto.randomUUID(), parent, targetSpaceId });
			}
			const remaining: typeof bulkBatches = [];
			for (const batch of bulkBatches) {
				try {
					const response = await catalog.bulkMoveEntries(create(BulkMoveEntriesRequestSchema, { spaceId, requestId: batch.requestId, items: batch.entries.map((item) => ({ entryId: item.id, expectedRevision: item.revision })), ...(batch.parent ? { parentId: batch.parent } : {}), ...(batch.targetSpaceId !== spaceId ? { targetSpaceId: batch.targetSpaceId } : {}) }));
					if (response.results.length !== batch.entries.length || response.results.some((result, index) => result.entryId !== batch.entries[index].id)) throw new Error('Nieprawidłowa odpowiedź serwera.');
					const rejected: Entry[] = [];
					response.results.forEach((result, index) => {
						const item = batch.entries[index];
						if (result.success) moved.push(create(EntrySchema, { ...item, spaceId: batch.targetSpaceId, parentId: batch.parent || undefined, revision: item.revision + 1 }));
						else { rejected.push(item); failed.push(item); }
					});
					if (rejected.length) remaining.push({ ...batch, entries: rejected, requestId: crypto.randomUUID() });
				} catch (cause) {
					firstFailure ??= cause;
					failed.push(...batch.entries);
					remaining.push(batch);
				}
			}
			bulkBatches = remaining;
			if (failed.length) error = `Nie udało się przenieść ${failed.length} z ${moveEntries.length} elementów. Zaznaczenie zachowano dla ponowienia.`;
			onmoved(moved, failed);
			busy = false;
			return;
		}
		const workers = Array.from({ length: Math.min(4, pending.length) }, async () => {
			while (nextIndex < pending.length) {
				const item = pending[nextIndex++];
				if (!item) continue;
				try {
					const result = await catalog.moveEntry(create(MoveEntryRequestSchema, {
						spaceId,
						...(targetSpaceId !== spaceId ? { targetSpaceId } : {}),
						entryId: item.id,
						...(parent ? { parentId: parent } : {}),
						expectedRevision: item.revision
					}));
					if (result.entry) moved.push(result.entry);
					else failed.push(item);
				} catch (cause) {
					firstFailure ??= cause;
					failed.push(item);
				}
			}
		});
		await Promise.all(workers);
		if (failed.length === 1 && pending.length === 1 && firstFailure) error = storageErrorMessage(firstFailure);
		else if (failed.length) error = `Nie udało się przenieść ${failed.length} z ${moveEntries.length} elementów. Zaznaczenie zachowano dla ponowienia.`;
		else error = '';
		onmoved(moved, failed);
		busy = false;
	}
</script>

<AppDialog labelledby="move-entry-title" busy={busy} onclose={onclose}>
	<section class="w-full max-w-lg space-y-4 rounded-md border border-border-line bg-bg-panel p-5 shadow-lg">
		<div>
			<h2 id="move-entry-title" class="text-base font-semibold text-text-main">Przenieś element</h2>
			<p class="mt-1 break-words text-sm text-text-muted">Wybierz folder dla {moveEntries.length === 1 ? `„${entry.name}”` : `${moveEntries.length} zaznaczonych elementów`}.</p>
		</div>

		<label class="block space-y-1 text-sm"><span>Przestrzeń docelowa</span><select aria-label="Przestrzeń docelowa" value={targetSpaceId} disabled={busy} onchange={(event) => switchSpace(event.currentTarget.value)} class="w-full rounded-md border border-border-line bg-bg-panel px-3 py-2">
			{#each [...spaces].sort((a, b) => a.kind === SpaceKind.SHARED ? -1 : b.kind === SpaceKind.SHARED ? 1 : 0) as space (space.id)}<option value={space.id}>{space.kind === SpaceKind.SHARED ? 'Main' : 'Pliki prywatne'}</option>{/each}
		</select></label>

		<nav class="flex min-w-0 items-center gap-1 overflow-x-auto text-sm" aria-label="Miejsce docelowe">
			<button type="button" disabled={busy} class="shrink-0 font-medium hover:underline" onclick={() => goTo(-1)}>
				{spaces.find((space) => space.id === targetSpaceId)?.kind === SpaceKind.SHARED ? 'Main' : 'Pliki prywatne'}
			</button>
			{#each path as folder, index (folder.id)}
				<CaretRight class="h-3.5 w-3.5 shrink-0 text-text-muted" aria-hidden="true" />
				<button type="button" disabled={busy} class="max-w-32 shrink-0 truncate text-text-muted hover:text-text-main hover:underline" onclick={() => goTo(index)}>
					{folder.name}
				</button>
			{/each}
		</nav>

		{#if path.length}
			<button type="button" disabled={busy || loading} class="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-text-main disabled:opacity-50" onclick={() => goTo(path.length - 2)}>
				<ArrowLeft class="h-4 w-4" /> Wstecz
			</button>
		{/if}

		<div class="max-h-64 min-h-24 overflow-y-auto rounded-md border border-border-line" aria-label="Foldery docelowe">
			{#if loading && !folders.length}
				<p class="p-4 text-sm text-text-muted" role="status">Ładowanie folderów…</p>
			{:else if !folders.length}
				<p class="p-4 text-sm text-text-muted">Brak podfolderów.</p>
			{:else}
				<ul class="divide-y divide-border-line">
					{#each folders as folder (folder.id)}
						<li>
							<button type="button" disabled={busy} class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-zinc-800" aria-label={`Otwórz folder ${folder.name}`} onclick={() => openFolder(folder)}>
								<Folder class="h-4 w-4 shrink-0 text-amber-600" />
								<span class="min-w-0 flex-1 truncate">{folder.name}</span>
								<CaretRight class="h-4 w-4 shrink-0 text-text-muted" />
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		</div>
		{#if nextPageToken}
			<button type="button" disabled={loading || busy} class="text-sm font-medium text-primary hover:underline disabled:opacity-50" onclick={() => void loadFolders(true)}>
				{loading ? 'Ładowanie…' : 'Pokaż więcej folderów'}
			</button>
		{/if}

		{#if error}<p class="rounded-md bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-300" role="alert">{error}</p>{/if}
		{#if targetIsInsideSource}<p class="text-sm text-red-600" role="alert">Folderu nie można przenieść do niego samego ani do jego podfolderu.</p>{/if}

		<div class="flex flex-wrap justify-end gap-2 border-t border-border-line pt-3">
			<button type="button" disabled={busy} onclick={onclose} class="rounded-md px-3 py-2 text-sm text-text-muted hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-zinc-800">Anuluj</button>
			<button type="button" disabled={busy || loading || targetIsSource || targetIsInsideSource} onclick={() => void moveTo(parentId)} class="rounded-md border border-border-line px-3 py-2 text-sm font-medium text-text-main hover:bg-gray-50 disabled:opacity-50 dark:hover:bg-zinc-800">Przenieś tutaj</button>
			<button type="button" disabled={busy || sourceAlreadyAtRoot} onclick={() => void moveTo('')} class="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
				{#if busy}<SpinnerGap class="h-4 w-4 animate-spin" />Przenoszenie…{:else}Przenieś do korzenia{/if}
			</button>
		</div>
	</section>
</AppDialog>
