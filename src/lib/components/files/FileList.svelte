<script lang="ts">
	import {
		Folder,
		File as FileIcon,
		DotsThreeVertical,
		DownloadSimple,
		Pencil,
		Trash
	} from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';

	type FileType = { $id: string; name: string; size: number; $createdAt: string };
	type FolderType = { $id: string; name: string; $createdAt: string; size?: number };

	let { files, folders, onDownload, onRename, onDelete, onNavigate } = $props<{
		files: FileType[];
		folders: FolderType[];
		onDownload: (id: string, name: string, isFolder: boolean) => void;
		onRename: (id: string, name: string, isFolder: boolean) => void;
		onDelete: (id: string, name: string, isFolder: boolean) => void;
		onNavigate: (id: string) => void;
	}>();

	let activeMenuId = $state<string | null>(null);

	function toggleMenu(id: string) {
		if (activeMenuId === id) activeMenuId = null;
		else activeMenuId = id;
	}
</script>

<div class="space-y-2 lg:hidden">
	<!-- Mobile list with bottom spacing -->
	{#if folders.length === 0 && files.length === 0}
		<div class="py-12 text-center text-text-muted">Folder is empty</div>
	{/if}

	{#each folders as folder (folder.$id)}
		<div class="relative rounded-md border border-border-line bg-bg-panel p-3 shadow-none">
			<div class="flex items-center gap-3">
				<button onclick={() => onNavigate(folder.$id)} class="shrink-0">
					<Folder
						class="h-8 w-8 fill-amber-400 text-amber-600 dark:fill-amber-500/50 dark:text-amber-400"
					/>
				</button>
				<button onclick={() => onNavigate(folder.$id)} class="min-w-0 flex-1 text-left">
					<p class="truncate text-sm font-medium text-text-main">{folder.name}</p>
					<p class="font-mono text-xs text-text-muted">Folder</p>
				</button>
				<button
					onclick={() => toggleMenu(folder.$id)}
					class="rounded-full p-2 text-text-muted hover:bg-gray-100"
				>
					<DotsThreeVertical class="h-5 w-5" />
				</button>
			</div>

			<!-- Context Menu -->
			{#if activeMenuId === folder.$id}
				<div class="mt-3 grid grid-cols-3 gap-2 border-t border-border-line pt-3">
					<button
						onclick={() => {
							onRename(folder.$id, folder.name, true);
							activeMenuId = null;
						}}
						class="flex flex-col items-center gap-1 rounded-md p-2 hover:bg-gray-50"
					>
						<Pencil class="h-5 w-5 text-text-main" />
						<span class="text-[10px] text-text-muted">Rename</span>
					</button>
					<button
						onclick={() => {
							onDownload(folder.$id, folder.name, true);
							activeMenuId = null;
						}}
						class="flex flex-col items-center gap-1 rounded-md p-2 hover:bg-gray-50"
					>
						<DownloadSimple class="h-5 w-5 text-primary" />
						<span class="text-[10px] text-text-muted">Download</span>
					</button>
					<button
						onclick={() => {
							onDelete(folder.$id, folder.name, true);
							activeMenuId = null;
						}}
						class="flex flex-col items-center gap-1 rounded-md p-2 hover:bg-red-50"
					>
						<Trash class="h-5 w-5 text-red-600" />
						<span class="text-[10px] text-text-muted">Delete</span>
					</button>
				</div>
			{/if}
		</div>
	{/each}

	{#each files as file (file.$id)}
		<div class="relative rounded-md border border-border-line bg-bg-panel p-3 shadow-none">
			<div class="flex items-center gap-3">
				<div class="shrink-0">
					<FileIcon class="h-8 w-8 text-blue-500 dark:text-blue-400" />
				</div>
				<div class="min-w-0 flex-1 text-left">
					<p class="truncate text-sm font-medium text-text-main">{file.name}</p>
					<p class="font-mono text-xs text-text-muted">{formatFileSize(file.size)}</p>
				</div>
				<button
					onclick={() => toggleMenu(file.$id)}
					class="rounded-full p-2 text-text-muted hover:bg-gray-100"
				>
					<DotsThreeVertical class="h-5 w-5" />
				</button>
			</div>

			{#if activeMenuId === file.$id}
				<div class="mt-3 grid grid-cols-3 gap-2 border-t border-border-line pt-3">
					<button
						onclick={() => {
							onRename(file.$id, file.name, false);
							activeMenuId = null;
						}}
						class="flex flex-col items-center gap-1 rounded-md p-2 hover:bg-gray-50"
					>
						<Pencil class="h-5 w-5 text-text-main" />
						<span class="text-[10px] text-text-muted">Rename</span>
					</button>
					<button
						onclick={() => {
							onDownload(file.$id, file.name, false);
							activeMenuId = null;
						}}
						class="flex flex-col items-center gap-1 rounded-md p-2 hover:bg-gray-50"
					>
						<DownloadSimple class="h-5 w-5 text-primary" />
						<span class="text-[10px] text-text-muted">Download</span>
					</button>
					<button
						onclick={() => {
							onDelete(file.$id, file.name, false);
							activeMenuId = null;
						}}
						class="flex flex-col items-center gap-1 rounded-md p-2 hover:bg-red-50"
					>
						<Trash class="h-5 w-5 text-red-600" />
						<span class="text-[10px] text-text-muted">Delete</span>
					</button>
				</div>
			{/if}
		</div>
	{/each}
</div>
