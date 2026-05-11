<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { UppyState, type UploadResult } from '$lib/modules/upload.svelte';
	import UppyZone from '$lib/components/upload/UppyZone.svelte';
	import FileBrowser from '$lib/components/files/FileBrowser.svelte';
	import CreateFolderDialog from '$lib/components/files/CreateFolderDialog.svelte';
	import StorageWidget from '$lib/components/files/StorageWidget.svelte';
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
		[key: string]: any;
	}

	let { data, titleRoot, rootHref } = $props<{
		data: StorageData;
		titleRoot: string;
		rootHref: string;
	}>();

	let showCreateFolder = $state(false);

	const uppyState = new UppyState({
		getFolderId: () => data.currentFolderId,
		isMainStorage: () => data.storageKind === 'main',
		onComplete: handleUploadComplete,
		onError: (err) => toast.error(`Upload error: ${err.message}`)
	});

	async function handleUploadComplete(results: UploadResult[]) {
		for (const result of results) {
			toast.success(`Uploaded: ${result.name}`);
		}
		invalidateAll();
	}

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
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-4 border-b border-border-line pb-4">
		<div class="flex items-center gap-2">
			<h1 class="text-xl font-bold tracking-tight text-text-main lg:text-2xl">
				{data.currentFolderId ? 'Folder View' : titleRoot}
			</h1>
			{#if data.currentFolderId}
				<span class="text-text-muted">/</span>
				<a href={rootHref} class="text-sm text-primary hover:underline">Root</a>
			{/if}
		</div>

		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<p class="font-mono text-xs text-text-muted lg:text-sm">
				{data.files.length} Files, {data.folders.length} Folders
			</p>

			{#if showStorageWidget}
				<StorageWidget usage={data.usage ?? 0} limit={data.limit ?? null} role={data.role} />
			{/if}
		</div>
	</div>

	<UppyZone
		{uppyState}
		onNewFolder={data.storageKind === 'main' ? undefined : () => (showCreateFolder = true)}
	/>

	<FileBrowser files={data.files} folders={data.folders} />

	{#if data.fileNextCursor || data.folderNextCursor}
		<div class="flex flex-wrap gap-2 border-t border-border-line pt-4">
			{#if data.fileNextCursor}
				<a
					href={pageHref('files', data.fileNextCursor)}
					class="rounded-md border border-border-line px-3 py-2 text-sm font-medium text-text-main hover:bg-gray-50 dark:hover:bg-zinc-800"
				>
					Load more files
				</a>
			{/if}
			{#if data.folderNextCursor}
				<a
					href={pageHref('folders', data.folderNextCursor)}
					class="rounded-md border border-border-line px-3 py-2 text-sm font-medium text-text-main hover:bg-gray-50 dark:hover:bg-zinc-800"
				>
					Load more folders
				</a>
			{/if}
		</div>
	{/if}
</div>

{#if showCreateFolder}
	<CreateFolderDialog
		parentFolderId={data.currentFolderId}
		onCancel={() => (showCreateFolder = false)}
	/>
{/if}
