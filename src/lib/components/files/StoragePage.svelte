<script lang="ts">
	import { invalidate } from '$app/navigation';
	import { UppyState, type UploadResult } from '$lib/modules/upload.svelte';
	import { SelectionState } from '$lib/modules/selection.svelte';
	import UppyZone from '$lib/components/upload/UppyZone.svelte';
	import UploadSplitButton from '$lib/components/upload/UploadSplitButton.svelte';
	import FileBrowser from '$lib/components/files/FileBrowser.svelte';
	import CreateFolderDialog from '$lib/components/files/CreateFolderDialog.svelte';
	import StorageWidget from '$lib/components/files/StorageWidget.svelte';
	import SelectionBar from '$lib/components/files/SelectionBar.svelte';
	import { FolderPlus, CaretRight } from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';

	interface StorageData {
		currentFolderId: string | null;
		files: any[];
		folders: any[];
		usage?: number;
		limit?: number;
		role?: string;
		fileNextCursor?: string | null;
		folderNextCursor?: string | null;
		storageKind?: 'user' | 'main';
		folderPath?: Array<{ id: string; name: string }>;
		[key: string]: any;
	}

	let { data, titleRoot, rootHref } = $props<{
		data: StorageData;
		titleRoot: string;
		rootHref: string;
	}>();

	import { page } from '$app/state';

	let showCreateFolder = $state(false);
	let pendingDestination = $state<'r2' | 'appwrite' | 'auto'>('auto');
	let isDragOver = $state(false);
	let dragCounter = $state(0);

	type SortBy = 'name' | 'date' | 'size';
	type SortDir = 'asc' | 'desc';
	let sortBy = $state<SortBy>('name');
	let sortDir = $state<SortDir>('asc');

	const selection = new SelectionState();

	const uppyState = new UppyState({
		getFolderId: () => data.currentFolderId,
		isMainStorage: () => data.storageKind === 'main',
		destination: () => pendingDestination,
		recommendedDestination: () =>
			(page.data.recommendedUploadDestination as 'r2' | 'appwrite' | 'hybrid') ?? 'hybrid',
		onComplete: handleUploadComplete,
		onError: (err) => {
			// F6: cancellations are intentional, not errors.
			if (err.name === 'AbortError' || /cancelled/i.test(err.message)) return;
			toast.error(`Błąd przesyłania: ${err.message}`);
		}
	});

	async function handleUploadComplete(results: UploadResult[]) {
		// F7: avoid flooding the user with one toast per file. The upload manager
		// invokes onComplete once per file; we coalesce notifications into a
		// short rolling window and show a single summary toast.
		uploadCompletionBuffer.push(...results);
		if (uploadToastTimer !== null) {
			clearTimeout(uploadToastTimer);
		}
		uploadToastTimer = setTimeout(() => {
			const count = uploadCompletionBuffer.length;
			if (count > 0) {
				if (count === 1) {
					toast.success(`Przesłano: ${uploadCompletionBuffer[0].name}`);
				} else {
					toast.success(`Przesłano ${count} plików`);
				}
			}
			uploadCompletionBuffer = [];
			uploadToastTimer = null;
			invalidate(window.location.pathname);
		}, 400);
	}

	let uploadCompletionBuffer = $state<UploadResult[]>([]);
	let uploadToastTimer: ReturnType<typeof setTimeout> | null = $state(null);

	function startUpload(destination: 'r2' | 'appwrite' | 'auto') {
		pendingDestination = destination;
		document.getElementById('file-input')?.click();
	}

	function onPageDragEnter(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		dragCounter++;
		isDragOver = true;
	}

	function onPageDragLeave() {
		dragCounter--;
		if (dragCounter <= 0) {
			dragCounter = 0;
			isDragOver = false;
		}
	}

	function onPageDragOver(e: DragEvent) {
		if (!e.dataTransfer?.types.includes('Files')) return;
		e.preventDefault();
		e.dataTransfer.dropEffect = 'copy';
	}

	function onPageDrop(e: DragEvent) {
		e.preventDefault();
		dragCounter = 0;
		isDragOver = false;
		if (!e.dataTransfer?.files.length) return;
		Array.from(e.dataTransfer.files).forEach((file) => uppyState.addFile(file));
	}

	function setSort(by: SortBy) {
		if (sortBy === by) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else {
			sortBy = by;
			sortDir = 'asc';
		}
	}

	function sortItems<T extends { name: string; $createdAt: string; size?: number }>(
		items: T[]
	): T[] {
		return [...items].sort((a, b) => {
			let cmp = 0;
			if (sortBy === 'name') cmp = a.name.localeCompare(b.name, 'pl');
			else if (sortBy === 'date') cmp = a.$createdAt.localeCompare(b.$createdAt);
			else if (sortBy === 'size') cmp = (a.size ?? 0) - (b.size ?? 0);
			return sortDir === 'asc' ? cmp : -cmp;
		});
	}

	const sortedFolders = $derived(sortItems(data.folders));
	const sortedFiles = $derived(sortItems(data.files));

	const showStorageWidget = $derived(
		typeof data.usage === 'number' && typeof data.limit === 'number'
	);

	function pageHref(kind: 'files' | 'folders', cursor: string) {
		const params = new URLSearchParams();
		if (data.currentFolderId) params.set('folder', data.currentFolderId);
		if (kind === 'files') params.set('fileCursor', cursor);
		else params.set('folderCursor', cursor);
		const query = params.toString();
		if (!query) return rootHref;
		if (rootHref === '?') return `?${query}`;
		return `${rootHref}${rootHref.includes('?') ? '&' : '?'}${query}`;
	}

	function folderHref(folderId: string) {
		if (rootHref === '?') return `?folder=${folderId}`;
		return `${rootHref}${rootHref.includes('?') ? '&' : '?'}folder=${folderId}`;
	}
</script>

<svelte:window
	ondragenter={onPageDragEnter}
	ondragleave={onPageDragLeave}
	ondragover={onPageDragOver}
	ondrop={onPageDrop}
/>

<!-- Page-level drop overlay -->
{#if isDragOver}
	<div
		class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-sm"
		aria-hidden="true"
	>
		<div
			class="rounded-2xl border-2 border-dashed border-primary bg-bg-panel/90 px-12 py-8 text-center shadow-xl"
		>
			<p class="text-lg font-semibold text-primary">Upuść pliki aby przesłać</p>
		</div>
	</div>
{/if}

<div class="space-y-4">
	<!-- Header + toolbar -->
	<div class="flex flex-col gap-3 border-b border-border-line pb-4">
		<!-- Breadcrumb -->
		<nav
			class="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 text-sm leading-none whitespace-nowrap"
			aria-label="Ścieżka"
		>
			<a
				href={rootHref}
				class="inline-flex h-5 shrink-0 items-center font-semibold text-text-main hover:underline"
				>{titleRoot}</a
			>
			{#each data.folderPath ?? [] as crumb (crumb.id)}
				<span class="inline-flex h-5 shrink-0 items-center text-text-muted" aria-hidden="true">
					<CaretRight class="h-3.5 w-3.5" />
				</span>
				<a
					href={folderHref(crumb.id)}
					class="inline-flex h-5 max-w-[45vw] shrink-0 items-center truncate text-text-muted hover:text-text-main hover:underline sm:max-w-[160px]"
				>
					{crumb.name}
				</a>
			{/each}
		</nav>

		<!-- Toolbar -->
		<div class="flex flex-wrap items-center justify-between gap-3">
			<p class="font-mono text-xs text-text-muted">
				{data.files.length} plików, {data.folders.length} folderów
			</p>

			<div class="flex flex-wrap items-center gap-2">
				{#if showStorageWidget}
					<StorageWidget usage={data.usage ?? 0} limit={data.limit ?? null} role={data.role} />
				{/if}

				<div class="hidden flex-wrap items-center gap-2 lg:flex">
					<button
						type="button"
						onclick={() => (showCreateFolder = true)}
						class="flex items-center gap-1.5 rounded-md border border-border-line bg-bg-panel px-3 py-2 text-sm font-medium text-text-main transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
					>
						<FolderPlus class="h-4 w-4" />
						<span>Nowy folder</span>
					</button>

					<UploadSplitButton onUpload={startUpload} />
				</div>
			</div>
		</div>
	</div>

	<UppyZone
		{uppyState}
		onMobileUpload={startUpload}
		onMobileNewFolder={() => (showCreateFolder = true)}
	/>

	<FileBrowser
		files={sortedFiles}
		folders={sortedFolders}
		{selection}
		{sortBy}
		{sortDir}
		onSort={setSort}
	/>

	{#if data.fileNextCursor || data.folderNextCursor}
		<div class="flex flex-wrap gap-2 border-t border-border-line pt-4">
			{#if data.fileNextCursor}
				<a
					href={pageHref('files', data.fileNextCursor)}
					class="rounded-md border border-border-line px-3 py-2 text-sm font-medium text-text-main hover:bg-gray-50 dark:hover:bg-zinc-800"
				>
					Więcej plików
				</a>
			{/if}
			{#if data.folderNextCursor}
				<a
					href={pageHref('folders', data.folderNextCursor)}
					class="rounded-md border border-border-line px-3 py-2 text-sm font-medium text-text-main hover:bg-gray-50 dark:hover:bg-zinc-800"
				>
					Więcej folderów
				</a>
			{/if}
		</div>
	{/if}
</div>

{#if selection.isSelectionMode}
	<SelectionBar {selection} files={data.files} folders={data.folders} />
{/if}

{#if showCreateFolder}
	<CreateFolderDialog
		parentFolderId={data.currentFolderId}
		onCancel={() => (showCreateFolder = false)}
	/>
{/if}
