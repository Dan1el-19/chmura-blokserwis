<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import { triggerDownload } from '$lib/utils/download';
	import FileList from './FileList.svelte';
	import FileTable from './FileTable.svelte';
	import RenameDialog from './RenameDialog.svelte';
	import ShareDialog from './ShareDialog.svelte';
	import type { SelectionState } from '$lib/modules/selection.svelte';

	type SortBy = 'name' | 'date' | 'size';
	type SortDir = 'asc' | 'desc';

	let { files, folders, selection, sortBy, sortDir, onSort, currentFolderId = null, parentFolderName = '', parentFolderId = null, onNavigateUp = () => {} } = $props<{
		files: any[];
		folders: any[];
		selection: SelectionState;
		sortBy: SortBy;
		sortDir: SortDir;
		onSort: (by: SortBy) => void;
		currentFolderId?: string | null;
		parentFolderName?: string;
		parentFolderId?: string | null;
		onNavigateUp?: () => void;
	}>();

	let renamingItem = $state<{ id: string; name: string; isFolder: boolean } | null>(null);
	let sharingItem = $state<{ id: string; isFolder: boolean } | null>(null);

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

	async function onDownload(id: string, name: string, isFolder: boolean) {
		try {
			if (isFolder) {
				toast.info('Pobieranie folderów jako ZIP jest niedostępne');
			} else {
				const res = await fetch(`/api/files/${id}?download=true`);
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
		{onDelete}
		{onRename}
		{onNavigate}
		{onShare}
		{currentFolderId}
		{parentFolderName}
		{onNavigateUp}
	/>
</div>

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
