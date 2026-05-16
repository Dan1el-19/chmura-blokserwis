<script lang="ts">
	import {
		Folder,
		File as FileIcon,
		DownloadSimple,
		Pencil,
		Trash,
		Share,
		ArrowUp,
		ArrowDown
	} from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';
	import { formatFileSize } from '$lib/utils/format';
	import type { SelectionState } from '$lib/modules/selection.svelte';

	type FileType = { $id: string; name: string; size: number; $createdAt: string };
	type FolderType = { $id: string; name: string; $createdAt: string; size?: number };
	type SortBy = 'name' | 'date' | 'size';
	type SortDir = 'asc' | 'desc';

	let {
		files,
		folders,
		selection,
		sortBy,
		sortDir,
		onSort,
		onDownload,
		onRename,
		onDelete,
		onNavigate,
		onShare,
		currentFolderId = null,
		parentFolderName = '',
		parentFolderId = null,
		onNavigateUp = () => {}
	} = $props<{
		files: FileType[];
		folders: FolderType[];
		selection: SelectionState;
		sortBy: SortBy;
		sortDir: SortDir;
		onSort: (by: SortBy) => void;
		onDownload: (id: string, name: string, isFolder: boolean) => void;
		onRename: (id: string, name: string, isFolder: boolean) => void;
		onDelete: (id: string, name: string, isFolder: boolean) => void;
		onNavigate: (id: string) => void;
		onShare: (id: string, isFolder: boolean) => void;
		currentFolderId?: string | null;
		parentFolderName?: string;
		parentFolderId?: string | null;
		onNavigateUp?: () => void;
	}>();

	const formatDate = (date: string) =>
		new Date(date).toLocaleDateString('pl-PL', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});

	const allIds = $derived([
		...folders.map((f: FolderType) => f.$id),
		...files.map((f: FileType) => f.$id)
	]);

	let lastClickedId = $state<string | null>(null);

	function handleRowClick(e: MouseEvent, id: string) {
		if (e.shiftKey && lastClickedId) {
			selection.selectRange(allIds, lastClickedId, id);
		} else if (e.ctrlKey || e.metaKey) {
			selection.toggle(id);
		} else if (selection.isSelectionMode) {
			selection.toggle(id);
		}
		lastClickedId = id;
	}

	function handleCheckbox(id: string) {
		selection.toggle(id);
		lastClickedId = id;
	}

	let dragOverFolderId = $state<string | null>(null);

	function onDragStart(e: DragEvent, id: string, name: string, isFolder: boolean) {
		e.dataTransfer!.effectAllowed = 'move';
		e.dataTransfer!.setData('text/plain', JSON.stringify({ id, name, isFolder }));
	}

	function onFolderDragOver(e: DragEvent, folderId: string) {
		e.preventDefault();
		e.dataTransfer!.dropEffect = 'move';
		dragOverFolderId = folderId;
	}

	function onFolderDragLeave() {
		dragOverFolderId = null;
	}

	async function onFolderDrop(e: DragEvent, targetFolderId: string) {
		e.preventDefault();
		dragOverFolderId = null;
		const raw = e.dataTransfer?.getData('text/plain');
		if (!raw) return;
		let payload: { id: string; name: string; isFolder: boolean };
		try {
			payload = JSON.parse(raw) as { id: string; name: string; isFolder: boolean };
		} catch {
			return;
		}
		const { id, name, isFolder } = payload;
		if (isFolder && id === targetFolderId) return;

		const endpoint = isFolder ? `/api/folders/${id}` : `/api/files/${id}`;
		try {
			const res = await fetch(endpoint, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ parentFolderId: targetFolderId || null })
			});
			if (!res.ok) {
				const body = await res.json().catch(() => ({}));
				toast.error(body.error || `Nie udało się przenieść "${name}"`);
				return;
			}
			toast.success(`Przeniesiono "${name}"`);
			window.dispatchEvent(new CustomEvent('file-moved'));
		} catch (err) {
			toast.error(err instanceof Error ? err.message : 'Błąd sieci podczas przenoszenia');
		}
	}
</script>

<div class="hidden rounded-lg border border-border-line bg-bg-panel lg:block">
	<table class="w-full text-left text-sm">
		<thead
			class="border-b border-border-line bg-gray-50/50 font-medium text-text-muted dark:bg-zinc-900/50"
		>
			<tr>
				<th class="w-10 px-4 py-3">
					<input
						type="checkbox"
						class="rounded accent-primary dark:bg-zinc-700"
						checked={selection.count > 0 && selection.count === allIds.length}
						indeterminate={selection.count > 0 && selection.count < allIds.length}
						onchange={() => {
							if (selection.count === allIds.length) selection.clear();
							else allIds.forEach((id) => selection.add(id));
						}}
						aria-label="Zaznacz wszystkie"
					/>
				</th>
				<th class="px-4 py-3">
					<button
						onclick={() => onSort('name')}
						class="flex items-center gap-1 font-medium hover:text-text-main"
					>
						Nazwa
						{#if sortBy === 'name'}
							{#if sortDir === 'asc'}<ArrowUp class="h-3.5 w-3.5" />{:else}<ArrowDown
									class="h-3.5 w-3.5"
								/>{/if}
						{/if}
					</button>
				</th>
				<th class="w-36 px-4 py-3">
					<button
						onclick={() => onSort('date')}
						class="flex items-center gap-1 font-medium hover:text-text-main"
					>
						Data
						{#if sortBy === 'date'}
							{#if sortDir === 'asc'}<ArrowUp class="h-3.5 w-3.5" />{:else}<ArrowDown
									class="h-3.5 w-3.5"
								/>{/if}
						{/if}
					</button>
				</th>
				<th class="w-28 px-4 py-3">
					<button
						onclick={() => onSort('size')}
						class="flex items-center gap-1 font-medium hover:text-text-main"
					>
						Rozmiar
						{#if sortBy === 'size'}
							{#if sortDir === 'asc'}<ArrowUp class="h-3.5 w-3.5" />{:else}<ArrowDown
									class="h-3.5 w-3.5"
								/>{/if}
						{/if}
					</button>
				</th>
				<th class="w-44 px-4 py-3 text-right font-medium">Akcje</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-border-line">
			{#if currentFolderId}
				<tr
					class="group cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50
						{dragOverFolderId === '__parent__' ? 'ring-2 ring-primary ring-inset' : ''}"
					onclick={onNavigateUp}
					ondragover={(e) => onFolderDragOver(e, '__parent__')}
					ondragleave={onFolderDragLeave}
					ondrop={(e) => onFolderDrop(e, parentFolderId ?? '')}
					aria-label="Przejdź do folderu nadrzędnego"
				>
					<td class="px-4 py-3"><div class="w-10"></div></td>
					<td class="px-4 py-3">
						<div class="flex items-center gap-2">
							<ArrowUp class="h-5 w-5 shrink-0 text-text-muted" />
							<span class="text-text-muted">{parentFolderName}</span>
						</div>
					</td>
					<td class="px-4 py-3"></td>
					<td class="px-4 py-3"></td>
					<td class="px-4 py-3"></td>
				</tr>
			{/if}
			{#if folders.length === 0 && files.length === 0}
				<tr>
					<td colspan="5" class="px-4 py-12 text-center text-text-muted">Folder jest pusty</td>
				</tr>
			{/if}

			{#each folders as folder (folder.$id)}
				<tr
					class="group cursor-pointer transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary dark:hover:bg-zinc-800/50
						{selection.has(folder.$id) ? 'bg-primary/5' : ''}
						{dragOverFolderId === folder.$id ? 'ring-2 ring-primary ring-inset' : ''}"
					tabindex="0"
					aria-label={`Folder ${folder.name}`}
					draggable="true"
					ondragstart={(e) => onDragStart(e, folder.$id, folder.name, true)}
					ondragover={(e) => onFolderDragOver(e, folder.$id)}
					ondragleave={onFolderDragLeave}
					ondrop={(e) => onFolderDrop(e, folder.$id)}
					onclick={(e) => handleRowClick(e, folder.$id)}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							onNavigate(folder.$id);
						} else if (e.key === ' ') {
							e.preventDefault();
							handleCheckbox(folder.$id);
						}
					}}
				>
					<td
						class="px-4 py-3"
						onclick={(e) => {
							e.stopPropagation();
							handleCheckbox(folder.$id);
						}}
					>
						<input
							type="checkbox"
							class="rounded accent-primary dark:bg-zinc-700"
							checked={selection.has(folder.$id)}
							onchange={() => handleCheckbox(folder.$id)}
							aria-label="Zaznacz {folder.name}"
						/>
					</td>
					<td class="px-4 py-3">
						<div class="flex items-center gap-2">
							<Folder
								class="h-5 w-5 shrink-0 fill-amber-400 text-amber-600 dark:fill-amber-500/50 dark:text-amber-400"
							/>
							<button
								onclick={(e) => {
									e.stopPropagation();
									onNavigate(folder.$id);
								}}
								class="truncate font-medium text-text-main hover:underline"
							>
								{folder.name}
							</button>
						</div>
					</td>
					<td class="px-4 py-3 font-mono text-xs text-text-muted"
						>{formatDate(folder.$createdAt)}</td
					>
					<td class="px-4 py-3 font-mono text-xs text-text-muted">—</td>
					<td class="px-4 py-3" onclick={(e) => e.stopPropagation()}>
						<div class="flex justify-end gap-1">
							<button
								type="button"
								onclick={() => onRename(folder.$id, folder.name, true)}
								class="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-700"
								aria-label="Zmień nazwę {folder.name}"
								title="Zmień nazwę"
							>
								<Pencil class="h-4 w-4" />
							</button>
							<button
								type="button"
								onclick={() => onDelete(folder.$id, folder.name, true)}
								class="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
								aria-label="Usuń {folder.name}"
								title="Usuń"
							>
								<Trash class="h-4 w-4" />
							</button>
						</div>
					</td>
				</tr>
			{/each}

			{#each files as file (file.$id)}
				<tr
					class="group cursor-pointer transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary dark:hover:bg-zinc-800/50
						{selection.has(file.$id) ? 'bg-primary/5' : ''}"
					tabindex="0"
					aria-label={`Plik ${file.name}`}
					draggable="true"
					ondragstart={(e) => onDragStart(e, file.$id, file.name, false)}
					onclick={(e) => handleRowClick(e, file.$id)}
					onkeydown={(e) => {
						if (e.key === 'Enter') {
							e.preventDefault();
							onDownload(file.$id, file.name, false);
						} else if (e.key === ' ') {
							e.preventDefault();
							handleCheckbox(file.$id);
						}
					}}
				>
					<td
						class="px-4 py-3"
						onclick={(e) => {
							e.stopPropagation();
							handleCheckbox(file.$id);
						}}
					>
						<input
							type="checkbox"
							class="rounded accent-primary dark:bg-zinc-700"
							checked={selection.has(file.$id)}
							onchange={() => handleCheckbox(file.$id)}
							aria-label="Zaznacz {file.name}"
						/>
					</td>
					<td class="max-w-[300px] truncate px-4 py-3 text-text-main" title={file.name}>
						<div class="flex items-center gap-2">
							<FileIcon class="h-5 w-5 shrink-0 text-blue-500 dark:text-blue-400" />
							<span class="truncate">{file.name}</span>
						</div>
					</td>
					<td class="px-4 py-3 font-mono text-xs text-text-muted">{formatDate(file.$createdAt)}</td>
					<td class="px-4 py-3 font-mono text-xs text-text-muted">{formatFileSize(file.size)}</td>
					<td class="px-4 py-3" onclick={(e) => e.stopPropagation()}>
						<div class="flex justify-end gap-1">
							<button
								type="button"
								onclick={() => onShare(file.$id, false)}
								class="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-700"
								aria-label="Udostępnij {file.name}"
								title="Udostępnij"
							>
								<Share class="h-4 w-4" />
							</button>
							<button
								type="button"
								onclick={() => onDownload(file.$id, file.name, false)}
								class="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-700"
								aria-label="Pobierz {file.name}"
								title="Pobierz"
							>
								<DownloadSimple class="h-4 w-4" />
							</button>
							<button
								type="button"
								onclick={() => onRename(file.$id, file.name, false)}
								class="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-700"
								aria-label="Zmień nazwę {file.name}"
								title="Zmień nazwę"
							>
								<Pencil class="h-4 w-4" />
							</button>
							<button
								type="button"
								onclick={() => onDelete(file.$id, file.name, false)}
								class="inline-flex h-8 w-8 items-center justify-center rounded-md text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
								aria-label="Usuń {file.name}"
								title="Usuń"
							>
								<Trash class="h-4 w-4" />
							</button>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
