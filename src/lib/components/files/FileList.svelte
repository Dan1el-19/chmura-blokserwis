<script lang="ts">
	import { Folder, File as FileIcon, DownloadSimple, Pencil, Trash, Share } from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import { longPress, swipeActions } from '$lib/actions/gestures';
	import type { SelectionState } from '$lib/modules/selection.svelte';

	type FileType = { $id: string; name: string; size: number; $createdAt: string };
	type FolderType = { $id: string; name: string; $createdAt: string; size?: number };

	let { files, folders, selection, onDownload, onRename, onDelete, onNavigate, onShare } =
		$props<{
			files: FileType[];
			folders: FolderType[];
			selection: SelectionState;
			onDownload: (id: string, name: string, isFolder: boolean) => void;
			onRename: (id: string, name: string, isFolder: boolean) => void;
			onDelete: (id: string, name: string, isFolder: boolean) => void;
			onNavigate: (id: string) => void;
			onShare: (id: string, isFolder: boolean) => void;
		}>();

	function handleTap(id: string, isFolder: boolean) {
		if (selection.isSelectionMode) {
			selection.toggle(id);
		} else if (isFolder) {
			onNavigate(id);
		}
	}

	function handleLongPress(id: string) {
		selection.add(id);
	}
</script>

<div class="space-y-2 lg:hidden">
	{#if folders.length === 0 && files.length === 0}
		<div class="py-12 text-center text-text-muted">Folder jest pusty</div>
	{/if}

	{#each folders as folder (folder.$id)}
		<div
			class="relative overflow-hidden rounded-md border border-border-line bg-bg-panel shadow-none
				{selection.has(folder.$id) ? 'border-primary bg-primary/5' : ''}"
			use:longPress={{ onLongPress: () => handleLongPress(folder.$id) }}
		>
			<!-- Swipe-revealed actions -->
			<div class="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
				<button
					onclick={() => onRename(folder.$id, folder.name, true)}
					class="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-text-main dark:bg-zinc-700"
					aria-label="Zmień nazwę"
				>
					<Pencil class="h-5 w-5" />
				</button>
				<button
					onclick={() => onDelete(folder.$id, folder.name, true)}
					class="flex h-10 w-10 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-900/40"
					aria-label="Usuń"
				>
					<Trash class="h-5 w-5" />
				</button>
			</div>

			<!-- Swipeable row -->
			<div
				class="relative z-10 flex items-center gap-3 bg-bg-panel p-3"
				use:swipeActions={{ threshold: 60 }}
				role="button"
				tabindex="0"
				onclick={() => handleTap(folder.$id, true)}
				onkeydown={(e) => e.key === 'Enter' && handleTap(folder.$id, true)}
			>
				{#if selection.isSelectionMode}
					<input
						type="checkbox"
						class="h-5 w-5 shrink-0 rounded"
						checked={selection.has(folder.$id)}
						onchange={() => selection.toggle(folder.$id)}
						onclick={(e) => e.stopPropagation()}
						aria-label="Zaznacz {folder.name}"
					/>
				{/if}
				<Folder
					class="h-8 w-8 shrink-0 fill-amber-400 text-amber-600 dark:fill-amber-500/50 dark:text-amber-400"
				/>
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium text-text-main">{folder.name}</p>
					<p class="font-mono text-xs text-text-muted">Folder</p>
				</div>
			</div>
		</div>
	{/each}

	{#each files as file (file.$id)}
		<div
			class="relative overflow-hidden rounded-md border border-border-line bg-bg-panel shadow-none
				{selection.has(file.$id) ? 'border-primary bg-primary/5' : ''}"
			use:longPress={{ onLongPress: () => handleLongPress(file.$id) }}
		>
			<!-- Swipe-revealed actions -->
			<div class="absolute inset-y-0 right-0 flex items-center gap-1 pr-2">
				<button
					onclick={() => onShare(file.$id, false)}
					class="flex h-10 w-10 items-center justify-center rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/40"
					aria-label="Udostępnij"
				>
					<Share class="h-5 w-5" />
				</button>
				<button
					onclick={() => onDownload(file.$id, file.name, false)}
					class="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-primary dark:bg-zinc-700"
					aria-label="Pobierz"
				>
					<DownloadSimple class="h-5 w-5" />
				</button>
				<button
					onclick={() => onRename(file.$id, file.name, false)}
					class="flex h-10 w-10 items-center justify-center rounded-md bg-gray-100 text-text-main dark:bg-zinc-700"
					aria-label="Zmień nazwę"
				>
					<Pencil class="h-5 w-5" />
				</button>
				<button
					onclick={() => onDelete(file.$id, file.name, false)}
					class="flex h-10 w-10 items-center justify-center rounded-md bg-red-100 text-red-600 dark:bg-red-900/40"
					aria-label="Usuń"
				>
					<Trash class="h-5 w-5" />
				</button>
			</div>

			<!-- Swipeable row -->
			<div
				class="relative z-10 flex items-center gap-3 bg-bg-panel p-3"
				use:swipeActions={{ threshold: 60 }}
				role="button"
				tabindex="0"
				onclick={() => handleTap(file.$id, false)}
				onkeydown={(e) => e.key === 'Enter' && handleTap(file.$id, false)}
			>
				{#if selection.isSelectionMode}
					<input
						type="checkbox"
						class="h-5 w-5 shrink-0 rounded"
						checked={selection.has(file.$id)}
						onchange={() => selection.toggle(file.$id)}
						onclick={(e) => e.stopPropagation()}
						aria-label="Zaznacz {file.name}"
					/>
				{/if}
				<FileIcon class="h-8 w-8 shrink-0 text-blue-500 dark:text-blue-400" />
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium text-text-main">{file.name}</p>
					<p class="font-mono text-xs text-text-muted">{formatFileSize(file.size)}</p>
				</div>
			</div>
		</div>
	{/each}
</div>
