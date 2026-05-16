<script lang="ts">
	import {
		Folder,
		File as FileIcon,
		DownloadSimple,
		Pencil,
		Trash,
		Share,
		DotsThreeVertical,
		ArrowUp
	} from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import { swipeAction } from '$lib/actions/gestures';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';
	import type { SelectionState } from '$lib/modules/selection.svelte';
	import { toast } from 'svelte-sonner';

	type FileType = { $id: string; name: string; size: number; $createdAt: string };
	type FolderType = { $id: string; name: string; $createdAt: string; size?: number };

	let { files, folders, selection, onDownload, onRename, onDelete, onNavigate, onShare, currentFolderId = null, parentFolderName = '', onNavigateUp = () => {} } = $props<{
		files: FileType[];
		folders: FolderType[];
		selection: SelectionState;
		onDownload: (id: string, name: string, isFolder: boolean) => void;
		onRename: (id: string, name: string, isFolder: boolean) => void;
		onDelete: (id: string, name: string, isFolder: boolean) => void;
		onNavigate: (id: string) => void;
		onShare: (id: string, isFolder: boolean) => void;
		currentFolderId?: string | null;
		parentFolderName?: string;
		onNavigateUp?: () => void;
	}>();

	function handleTap(id: string, isFolder: boolean) {
		if (selection.isSelectionMode) {
			selection.toggle(id);
		} else if (isFolder) {
			onNavigate(id);
		} else {
			const file = files.find((f: FileType) => f.$id === id);
			if (file) openSheet({ kind: 'file', id: file.$id, name: file.name });
		}
	}

	let longPressTimer: ReturnType<typeof setTimeout> | null = null;

	function setupLongPress(e: PointerEvent, id: string) {
		const startX = e.clientX;
		const startY = e.clientY;

		longPressTimer = setTimeout(() => {
			if ('vibrate' in navigator) navigator.vibrate(50);
			selection.add(id);
			longPressTimer = null;
		}, 500);

		function onMove(ev: PointerEvent) {
			if (Math.abs(ev.clientX - startX) > 12 || Math.abs(ev.clientY - startY) > 12) {
				clearLongPress();
				cleanup();
			}
		}

		function onUp() {
			clearLongPress();
			cleanup();
		}

		function cleanup() {
			document.removeEventListener('pointermove', onMove);
			document.removeEventListener('pointerup', onUp);
		}

		document.addEventListener('pointermove', onMove);
		document.addEventListener('pointerup', onUp, { once: true });
	}

	function clearLongPress() {
		if (longPressTimer) {
			clearTimeout(longPressTimer);
			longPressTimer = null;
		}
	}

	type SheetTarget =
		| { kind: 'file'; id: string; name: string }
		| { kind: 'folder'; id: string; name: string };

	let openMenuId = $state<string | null>(null);
	let sheetTarget = $state<SheetTarget | null>(null);
	let sheetOpen = $state(false);

	function openSheet(target: SheetTarget) {
		sheetTarget = target;
		openMenuId = target.id;
		sheetOpen = true;
	}

	function closeSheet() {
		sheetOpen = false;
		openMenuId = null;
	}

	function handleFolderShare(id: string, name: string) {
		toast.info(`Udostępnianie folderów (${name}) wkrótce.`);
		void id;
	}
</script>

<div class="space-y-2 select-none lg:hidden">
	{#if currentFolderId}
		<div
			class="relative overflow-hidden rounded-md border border-border-line bg-bg-panel"
			role="button"
			tabindex="0"
			onclick={onNavigateUp}
			onkeydown={(e) => e.key === 'Enter' && onNavigateUp()}
		>
			<div class="flex items-center gap-3 p-3">
				<ArrowUp class="h-8 w-8 shrink-0 text-text-muted" />
				<div class="min-w-0 flex-1">
					<p class="truncate text-sm font-medium text-text-muted">{parentFolderName}</p>
				</div>
			</div>
		</div>
	{/if}
	{#if folders.length === 0 && files.length === 0}
		<div class="py-12 text-center text-text-muted">Folder jest pusty</div>
	{/if}

	{#each folders as folder (folder.$id)}
		<div
			class="relative overflow-hidden rounded-md border border-border-line bg-bg-panel
				{selection.has(folder.$id) ? 'border-primary bg-primary/5' : ''}"
		>
			<div
				data-row-id={folder.$id}
				class="relative z-10 flex items-center gap-3 bg-bg-panel p-3"
				use:swipeAction={{
					threshold: 80,
					disabled: selection.isSelectionMode,
					leftLabel: 'Usuń',
					rightLabel: 'Udostępnij',
					leftColor: '#dc2626',
					rightColor: '#3b82f6',
					onSwipeLeft: () => onDelete(folder.$id, folder.name, true),
					onSwipeRight: () => handleFolderShare(folder.$id, folder.name)
				}}
				role="button"
				tabindex="0"
				onpointerdown={(e) => setupLongPress(e, folder.$id)}
				onpointerup={clearLongPress}
				onclick={() => handleTap(folder.$id, true)}
				onkeydown={(e) => e.key === 'Enter' && handleTap(folder.$id, true)}
			>
				{#if selection.isSelectionMode}
					<input
						type="checkbox"
						class="h-6 w-6 shrink-0 rounded"
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
				<button
					type="button"
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-800"
					aria-label="Akcje dla {folder.name}"
					onpointerdown={(e) => e.stopPropagation()}
					onclick={(e) => {
						e.stopPropagation();
						openSheet({ kind: 'folder', id: folder.$id, name: folder.name });
					}}
				>
					<DotsThreeVertical class="h-5 w-5" weight="bold" />
				</button>
			</div>
		</div>
	{/each}

	{#each files as file (file.$id)}
		<div
			class="relative overflow-hidden rounded-md border border-border-line bg-bg-panel
				{selection.has(file.$id) ? 'border-primary bg-primary/5' : ''}"
		>
			<div
				data-row-id={file.$id}
				class="relative z-10 flex items-center gap-3 bg-bg-panel p-3"
				use:swipeAction={{
					threshold: 80,
					disabled: selection.isSelectionMode,
					leftLabel: 'Usuń',
					rightLabel: 'Udostępnij',
					leftColor: '#dc2626',
					rightColor: '#3b82f6',
					onSwipeLeft: () => onDelete(file.$id, file.name, false),
					onSwipeRight: () => onShare(file.$id, false)
				}}
				role="button"
				tabindex="0"
				onpointerdown={(e) => setupLongPress(e, file.$id)}
				onpointerup={clearLongPress}
				onclick={() => handleTap(file.$id, false)}
				onkeydown={(e) => e.key === 'Enter' && handleTap(file.$id, false)}
			>
				{#if selection.isSelectionMode}
					<input
						type="checkbox"
						class="h-6 w-6 shrink-0 rounded"
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
				<button
					type="button"
					class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-800"
					aria-label="Akcje dla {file.name}"
					onpointerdown={(e) => e.stopPropagation()}
					onclick={(e) => {
						e.stopPropagation();
						openSheet({ kind: 'file', id: file.$id, name: file.name });
					}}
				>
					<DotsThreeVertical class="h-5 w-5" weight="bold" />
				</button>
			</div>
		</div>
	{/each}
</div>

<BottomSheet bind:open={sheetOpen} title={sheetTarget?.name}>
	{#if sheetTarget?.kind === 'file'}
		{@const target = sheetTarget}
		<button
			type="button"
			class="flex h-12 w-full items-center gap-3 rounded-md px-4 text-left text-sm font-medium text-text-main hover:bg-gray-50 dark:hover:bg-zinc-800"
			onclick={() => {
				closeSheet();
				onShare(target.id, false);
			}}
		>
			<span
				class="flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/40"
			>
				<Share class="h-4 w-4" />
			</span>
			Udostępnij
		</button>
		<button
			type="button"
			class="flex h-12 w-full items-center gap-3 rounded-md px-4 text-left text-sm font-medium text-text-main hover:bg-gray-50 dark:hover:bg-zinc-800"
			onclick={() => {
				closeSheet();
				onDownload(target.id, target.name, false);
			}}
		>
			<span
				class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-primary dark:bg-zinc-700"
			>
				<DownloadSimple class="h-4 w-4" />
			</span>
			Pobierz
		</button>
		<button
			type="button"
			class="flex h-12 w-full items-center gap-3 rounded-md px-4 text-left text-sm font-medium text-text-main hover:bg-gray-50 dark:hover:bg-zinc-800"
			onclick={() => {
				closeSheet();
				onRename(target.id, target.name, false);
			}}
		>
			<span
				class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-text-main dark:bg-zinc-700"
			>
				<Pencil class="h-4 w-4" />
			</span>
			Zmień nazwę
		</button>
		<div class="mx-4 my-1 border-t border-border-line"></div>
		<button
			type="button"
			class="flex h-12 w-full items-center gap-3 rounded-md px-4 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
			onclick={() => {
				closeSheet();
				onDelete(target.id, target.name, false);
			}}
		>
			<span
				class="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40"
			>
				<Trash class="h-4 w-4" />
			</span>
			Usuń
		</button>
	{:else if sheetTarget?.kind === 'folder'}
		{@const target = sheetTarget}
		<button
			type="button"
			class="flex h-12 w-full items-center gap-3 rounded-md px-4 text-left text-sm font-medium text-text-main hover:bg-gray-50 dark:hover:bg-zinc-800"
			onclick={() => {
				closeSheet();
				onRename(target.id, target.name, true);
			}}
		>
			<span
				class="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-text-main dark:bg-zinc-700"
			>
				<Pencil class="h-4 w-4" />
			</span>
			Zmień nazwę
		</button>
		<div class="mx-4 my-1 border-t border-border-line"></div>
		<button
			type="button"
			class="flex h-12 w-full items-center gap-3 rounded-md px-4 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
			onclick={() => {
				closeSheet();
				onDelete(target.id, target.name, true);
			}}
		>
			<span
				class="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40"
			>
				<Trash class="h-4 w-4" />
			</span>
			Usuń
		</button>
	{/if}
</BottomSheet>
