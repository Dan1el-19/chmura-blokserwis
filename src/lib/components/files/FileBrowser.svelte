<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { toast } from 'svelte-sonner';
	import FileList from './FileList.svelte';
	import FileTable from './FileTable.svelte';
	import RenameDialog from './RenameDialog.svelte';
	import ShareDialog from './ShareDialog.svelte';

	let { files, folders } = $props();

	let renamingItem = $state<{ id: string; name: string; isFolder: boolean } | null>(null);
	let sharingItem = $state<{ id: string; isFolder: boolean } | null>(null);

	async function onNavigate(id: string) {
		window.location.href = `?folder=${id}`;
	}

	async function onDownload(id: string, name: string, isFolder: boolean) {
		try {
			if (isFolder) {
				toast.info(`Przygotowywanie: ${name}.zip`);
				window.location.href = `/api/folders/${id}/download`;
			} else {
				const res = await fetch(`/api/files/${id}?download=true`);
				const data = await res.json();
				if (data.downloadUrl) {
					toast.info(`Pobieranie: ${name}`);
					window.location.href = data.downloadUrl;
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
		sharingItem = { id, isFolder };
	}
</script>

<div class="mt-4">
	<FileTable {files} {folders} {onDownload} {onDelete} {onRename} {onNavigate} {onShare} />

	<FileList {files} {folders} {onDownload} {onDelete} {onRename} {onNavigate} {onShare} />
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
	{#if sharingItem.isFolder}
		<ShareDialog folderId={sharingItem.id} onClose={() => (sharingItem = null)} />
	{:else}
		<ShareDialog fileId={sharingItem.id} onClose={() => (sharingItem = null)} />
	{/if}
{/if}

