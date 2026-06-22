<script lang="ts">
	import { invalidateAll, pushState } from '$app/navigation';
	import { page } from '$app/state';
	import { toast } from 'svelte-sonner';
	import { triggerDownload } from '$lib/utils/download';
	import {
		canPreviewInline,
		getPreviewEndpoint,
		type FilePreviewResponse,
		type FilePreviewTarget,
		type StorageKind
	} from '$lib/utils/file-preview';
	import FileList from './FileList.svelte';
	import FileTable from './FileTable.svelte';
	import RenameDialog from './RenameDialog.svelte';
	import ShareDialog from './ShareDialog.svelte';
	import FilePreviewDialog from './FilePreviewDialog.svelte';
	import type { SelectionState } from '$lib/modules/selection.svelte';

	type SortBy = 'name' | 'date' | 'size';
	type SortDir = 'asc' | 'desc';

	type FileItem = {
		$id: string;
		name: string;
		size?: number;
		mimeType?: string | null;
		thumbnailUrl?: string | null;
	};

	let {
		files,
		folders,
		selection,
		sortBy,
		sortDir,
		onSort,
		storageKind = 'user',
		targetUserId = null,
		currentFolderId = null,
		parentFolderName = '',
		parentFolderId = null,
		onNavigateUp = () => {}
	} = $props<{
		files: FileItem[];
		folders: any[];
		selection: SelectionState;
		sortBy: SortBy;
		sortDir: SortDir;
		onSort: (by: SortBy) => void;
		storageKind?: StorageKind;
		targetUserId?: string | null;
		currentFolderId?: string | null;
		parentFolderName?: string;
		parentFolderId?: string | null;
		onNavigateUp?: () => void;
	}>();

	let renamingItem = $state<{ id: string; name: string; isFolder: boolean } | null>(null);
	let sharingItem = $state<{ id: string; isFolder: boolean } | null>(null);
	let previewTarget = $state<FilePreviewTarget | null>(null);
	let previewData = $state<FilePreviewResponse | null>(null);
	let previewLoading = $state(false);
	let previewError = $state<string | null>(null);

	$effect(() => {
		const previewFileId = page.state.previewFileId;
		if (!previewFileId || previewTarget?.id === previewFileId) return;

		const file = files.find((item: FileItem) => item.$id === previewFileId);
		if (file) {
			void onPreview(file);
		}
	});

	// Refresh after drag-drop move
	$effect(() => {
		function onFileMoved() {
			invalidateAll();
		}
		window.addEventListener('file-moved', onFileMoved);
		return () => window.removeEventListener('file-moved', onFileMoved);
	});

	async function onNavigate(id: string) {
		window.location.href = `?folder=${id}`;
	}

	function buildDownloadUrl(fileId: string): string {
		if (storageKind === 'main') {
			return `/api/files/${fileId}?download=true`;
		}
		const base = `/api/files/${fileId}?download=true`;
		if (!targetUserId) return base;
		return `${base}&targetUserId=${encodeURIComponent(targetUserId)}`;
	}

	async function onDownload(id: string, name: string, isFolder: boolean) {
		try {
			if (isFolder) {
				toast.info('Pobieranie folderów jako ZIP jest niedostępne');
			} else {
				const res = await fetch(buildDownloadUrl(id));
				const data = await res.json();
				if (data.downloadUrl) {
					toast.info(`Pobieranie: ${name}`);
					triggerDownload(data.downloadUrl, name);
				}
			}
		} catch (e: any) {
			toast.error(e.message);
		}
	}

	async function fetchPreview(file: FileItem) {
		previewLoading = true;
		previewError = null;
		previewData = null;

		try {
			const res = await fetch(getPreviewEndpoint({ fileId: file.$id, storageKind, targetUserId }));
			const body = await res.json();
			if (!res.ok) throw new Error(body.error || 'Nie udalo sie pobrac podgladu');
			previewData = body;
		} catch (error) {
			previewError = error instanceof Error ? error.message : 'Nie udalo sie pobrac podgladu';
		} finally {
			previewLoading = false;
		}
	}

	async function onPreview(file: FileItem) {
		if (!canPreviewInline(file.mimeType)) {
			await onDownload(file.$id, file.name, false);
			return;
		}

		previewTarget = {
			id: file.$id,
			name: file.name,
			mimeType: file.mimeType ?? '',
			size: file.size ?? 0
		};
		pushState('', { previewFileId: file.$id });
		await fetchPreview(file);
	}

	function closePreview() {
		previewTarget = null;
		previewData = null;
		previewError = null;
		previewLoading = false;
		if (page.state.previewFileId) {
			history.back();
		}
	}

	async function onDelete(id: string, name: string, isFolder: boolean) {
		if (!confirm(`Usunąć "${name}"?`)) return;
		try {
			const endpoint = isFolder ? `/api/folders/${id}` : `/api/files/${id}`;
			const res = await fetch(endpoint, { method: 'DELETE' });
			if (res.ok) {
				toast.success(`Usunięto "${name}"`);
				invalidateAll();
			} else {
				toast.error('Nie udało się usunąć');
			}
		} catch (e: any) {
			toast.error(e.message);
		}
	}

	function onRename(id: string, name: string, isFolder: boolean) {
		renamingItem = { id, name, isFolder };
	}

	function onShare(id: string, isFolder: boolean = false) {
		if (isFolder) {
			toast.info('Udostępnianie folderów jest niedostępne');
			return;
		}
		sharingItem = { id, isFolder };
	}
</script>

<div class="mt-4">
	<FileTable
		{files}
		{folders}
		{selection}
		{sortBy}
		{sortDir}
		{onSort}
		{onDownload}
		{onPreview}
		{onDelete}
		{onRename}
		{onNavigate}
		{onShare}
		{currentFolderId}
		{parentFolderName}
		{parentFolderId}
		{onNavigateUp}
	/>
	<FileList
		{files}
		{folders}
		{selection}
		{onDownload}
		{onPreview}
		{onDelete}
		{onRename}
		{onNavigate}
		{onShare}
		{currentFolderId}
		{parentFolderName}
		{onNavigateUp}
	/>
</div>

<FilePreviewDialog
	open={previewTarget !== null}
	file={previewTarget}
	preview={previewData}
	loading={previewLoading}
	error={previewError}
	onClose={closePreview}
	onRetry={() => {
		if (previewTarget) {
			const file = files.find((item: FileItem) => item.$id === previewTarget?.id);
			if (file) void fetchPreview(file);
		}
	}}
/>

{#if renamingItem}
	<RenameDialog
		fileId={renamingItem.id}
		currentName={renamingItem.name}
		isFolder={renamingItem.isFolder}
		onCancel={() => (renamingItem = null)}
		onSuccess={() => {
			renamingItem = null;
			invalidateAll();
		}}
	/>
{/if}

{#if sharingItem}
	<ShareDialog fileId={sharingItem.id} onClose={() => (sharingItem = null)} />
{/if}
