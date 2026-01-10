<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { UppyState, type UploadResult } from '$lib/modules/upload.svelte';
	import UppyZone from '$lib/components/upload/UppyZone.svelte';
	import FileBrowser from '$lib/components/files/FileBrowser.svelte';
	import CreateFolderDialog from '$lib/components/files/CreateFolderDialog.svelte';
	import StorageWidget from '$lib/components/files/StorageWidget.svelte';
	import { toast } from 'svelte-sonner';

	let { data } = $props();

	let showCreateFolder = $state(false);

	const uppyState = new UppyState({
		onComplete: handleUploadComplete,
		onError: (err) => toast.error(`Upload error: ${err.message}`)
	});

	async function handleUploadComplete(results: UploadResult[]) {
		for (const result of results) {
			const formData = new FormData();
			formData.append('name', result.name);
			formData.append('size', result.size.toString());
			formData.append('mimeType', result.type);
			formData.append('r2Key', result.key);
			if (data.currentFolderId) {
				formData.append('parentFolderId', data.currentFolderId);
			}

			try {
				const response = await fetch('?/createFile', {
					method: 'POST',
					body: formData
				});
				if (response.ok) {
					toast.success(`Uploaded: ${result.name}`);
				} else {
					const json = await response.json();
					toast.error(`Failed to save ${result.name}: ${json?.data?.error || 'Unknown error'}`);
				}
			} catch (e: any) {
				toast.error(`Error saving ${result.name}: ${e.message}`);
			}
		}
		invalidateAll();
	}
</script>

<div class="space-y-6">
	<div class="flex flex-col gap-4 border-b border-border-line pb-4">
		<div class="flex items-center gap-2">
			<h1 class="text-xl font-bold tracking-tight text-text-main lg:text-2xl">
				{data.currentFolderId ? 'Folder View' : 'My Files'}
			</h1>
			{#if data.currentFolderId}
				<span class="text-text-muted">/</span>
				<a href="?" class="text-sm text-primary hover:underline">Root</a>
			{/if}
		</div>

		<div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
			<p class="font-mono text-xs text-text-muted lg:text-sm">
				{data.files.length} Files, {data.folders.length} Folders
			</p>

			<StorageWidget usage={data.usage} limit={data.limit} role={data.role} />
		</div>
	</div>

	<UppyZone {uppyState} onNewFolder={() => (showCreateFolder = true)} />

	<FileBrowser files={data.files} folders={data.folders} />
</div>

{#if showCreateFolder}
	<CreateFolderDialog
		parentFolderId={data.currentFolderId}
		onCancel={() => (showCreateFolder = false)}
	/>
{/if}
