<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import {
		Folder,
		FileText,
		DownloadSimple,
		Trash,
		ArrowLeft,
		Folder as FolderDownload,
		House,
		Cloud
	} from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import { toast } from 'svelte-sonner';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	let { data } = $props();

	async function deleteFile(fileId: string, fileName: string) {
		if (!confirm(`Delete "${fileName}"?`)) return;

		try {
			const res = await fetch(`/api/files/${fileId}?targetUserId=${data.targetUser.$id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				toast.success(`Deleted: ${fileName}`);
				invalidateAll();
			} else {
				const result = await res.json();
				toast.error(result.error || 'Delete failed');
			}
		} catch (e: any) {
			toast.error(e.message);
		}
	}

	async function downloadFile(fileId: string, fileName: string) {
		try {
			const res = await fetch(
				`/api/files/${fileId}?download=true&targetUserId=${data.targetUser.$id}`
			);
			const result = await res.json();
			if (result.downloadUrl) {
				toast.info(`Downloading: ${fileName}`);
				window.location.href = result.downloadUrl;
			}
		} catch (e: any) {
			toast.error(e.message);
		}
	}

	async function deleteFolder(folderId: string, folderName: string) {
		if (!confirm(`Delete folder "${folderName}" and all contents?`)) return;

		try {
			const res = await fetch(`/api/folders/${folderId}?targetUserId=${data.targetUser.$id}`, {
				method: 'DELETE'
			});
			if (res.ok) {
				toast.success(`Deleted: ${folderName}`);
				invalidateAll();
			} else {
				const result = await res.json();
				toast.error(result.error || 'Delete failed');
			}
		} catch (e: any) {
			toast.error(e.message);
		}
	}

	function downloadFolder(folderId: string, folderName: string) {
		toast.info(`Archiving: ${folderName}.zip`);
		window.location.href = `/api/folders/${folderId}/download?targetUserId=${data.targetUser.$id}`;
	}
</script>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center gap-4">
		<a href="/admin/users/{data.targetUser.$id}">
			<Button variant="ghost" size="icon">
				<ArrowLeft class="h-5 w-5" />
			</Button>
		</a>
		<div>
			<h1 class="text-xl font-bold tracking-tight text-text-main lg:text-2xl">
				{data.targetUser.email}
			</h1>
			<p class="text-sm text-text-muted">Storage Preview Mode</p>
		</div>
	</div>

	<!-- Breadcrumbs -->
	<div class="flex flex-wrap items-center gap-1 text-sm text-text-muted">
		{#each data.breadcrumbs as crumb, i}
			{#if i > 0}
				<span class="text-border-line">/</span>
			{/if}
			{#if crumb.id === null}
				<a
					href="/preview/{data.targetUser.$id}"
					class="flex items-center gap-1 hover:text-primary hover:underline"
				>
					<House class="h-4 w-4" />
					<span class="sr-only">Root</span>
				</a>
			{:else}
				<a
					href="/preview/{data.targetUser.$id}?folder={crumb.id}"
					class="hover:text-primary hover:underline"
				>
					{crumb.name}
				</a>
			{/if}
		{/each}
	</div>

	<!-- Content -->
	<Card class="min-h-[400px]">
		{#if data.files.length === 0 && data.folders.length === 0}
			<div class="flex h-64 flex-col items-center justify-center text-text-muted">
				<div class="mb-4 rounded-full bg-bg-app p-4">
					<Cloud class="h-8 w-8 opacity-20" />
				</div>
				<p>This folder is empty</p>
			</div>
		{:else}
			<!-- Table Layout -->
			<div class="w-full">
				<div
					class="hidden border-b border-border-line bg-bg-app px-4 py-3 text-xs font-medium text-text-muted uppercase lg:grid lg:grid-cols-[auto_1fr_auto_auto_auto] lg:gap-4"
				>
					<div class="w-6"></div>
					<div>Name</div>
					<div class="w-32">Date</div>
					<div class="w-24">Size</div>
					<div class="w-24 text-right">Actions</div>
				</div>

				<div class="divide-y divide-border-line">
					<!-- Folders -->
					{#each data.folders as folder}
						<div
							class="hover:bg-bg-msg-hover flex flex-col gap-2 p-4 transition-colors lg:grid lg:grid-cols-[auto_1fr_auto_auto_auto] lg:items-center lg:gap-4 lg:py-2"
						>
							<div class="hidden text-amber-500 lg:block">
								<Folder class="h-4 w-4" />
							</div>
							<div class="flex items-center gap-3 lg:gap-0">
								<Folder class="h-5 w-5 text-amber-500 lg:hidden" />
								<a
									href="/preview/{data.targetUser.$id}?folder={folder.$id}"
									class="font-medium text-text-main hover:text-primary hover:underline"
								>
									{folder.name}
								</a>
							</div>
							<div class="text-xs text-text-muted lg:text-sm">
								{new Date(folder.$createdAt).toLocaleDateString('pl-PL')}
							</div>
							<div class="text-xs text-text-muted lg:text-sm">
								{folder.size ? formatFileSize(folder.size) : '-'}
							</div>
							<div class="flex justify-end gap-1">
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 text-green-600 hover:bg-green-50 hover:text-green-700"
									onclick={() => downloadFolder(folder.$id, folder.name)}
									title="Download ZIP"
								>
									<DownloadSimple class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
									onclick={() => deleteFolder(folder.$id, folder.name)}
									title="Delete"
								>
									<Trash class="h-4 w-4" />
								</Button>
							</div>
						</div>
					{/each}

					<!-- Files -->
					{#each data.files as file}
						<div
							class="hover:bg-bg-msg-hover flex flex-col gap-2 p-4 transition-colors lg:grid lg:grid-cols-[auto_1fr_auto_auto_auto] lg:items-center lg:gap-4 lg:py-2"
						>
							<div class="hidden text-text-muted lg:block">
								<FileText class="h-4 w-4" />
							</div>
							<div class="flex items-center gap-3 lg:gap-0">
								<FileText class="h-5 w-5 text-text-muted lg:hidden" />
								<span class="truncate font-medium text-text-main" title={file.name}>
									{file.name}
								</span>
							</div>
							<div class="text-xs text-text-muted lg:text-sm">
								{new Date(file.$createdAt).toLocaleDateString('pl-PL')}
							</div>
							<div class="text-xs text-text-muted lg:text-sm">
								{formatFileSize(file.size)}
							</div>
							<div class="flex justify-end gap-1">
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 text-green-600 hover:bg-green-50 hover:text-green-700"
									onclick={() => downloadFile(file.$id, file.name)}
									title="Download"
								>
									<DownloadSimple class="h-4 w-4" />
								</Button>
								<Button
									variant="ghost"
									size="icon"
									class="h-8 w-8 text-red-600 hover:bg-red-50 hover:text-red-700"
									onclick={() => deleteFile(file.$id, file.name)}
									title="Delete"
								>
									<Trash class="h-4 w-4" />
								</Button>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	</Card>
</div>
