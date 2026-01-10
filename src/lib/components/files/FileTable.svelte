<script lang="ts">
	import { Folder, File as FileIcon, DownloadSimple, Pencil, Trash } from 'phosphor-svelte';
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

	const formatDate = (date: string) =>
		new Date(date).toLocaleDateString('pl-PL', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});
</script>

<div class="hidden overflow-hidden rounded-lg border border-border-line bg-bg-panel lg:block">
	<table class="w-full text-left text-sm lg:text-base">
		<thead
			class="border-b border-border-line bg-gray-50/50 font-medium text-text-muted dark:bg-zinc-900/50"
		>
			<tr>
				<th class="w-12 px-4 py-3 lg:w-14 lg:px-6 lg:py-4"></th>
				<th class="px-4 py-3 font-medium lg:px-6 lg:py-4">Name</th>
				<th class="w-32 px-4 py-3 font-medium lg:w-40 lg:px-6 lg:py-4">Date</th>
				<th class="w-24 px-4 py-3 font-medium lg:w-32 lg:px-6 lg:py-4">Size</th>
				<th class="w-28 px-4 py-3 text-right font-medium lg:w-36 lg:px-6 lg:py-4">Actions</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-border-line">
			{#if folders.length === 0 && files.length === 0}
				<tr>
					<td
						colspan="5"
						class="px-4 py-12 text-center text-text-muted lg:px-6 lg:py-16 lg:text-lg"
					>
						Folder is empty
					</td>
				</tr>
			{/if}

			{#each folders as folder (folder.$id)}
				<tr class="group transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50">
					<td class="px-4 py-3 lg:px-6 lg:py-4">
						<Folder
							class="h-5 w-5 fill-amber-400 text-amber-600 lg:h-6 lg:w-6 dark:fill-amber-500/50 dark:text-amber-400"
						/>
					</td>
					<td class="px-4 py-3 lg:px-6 lg:py-4">
						<button
							onclick={() => onNavigate(folder.$id)}
							class="w-full truncate text-left font-medium text-text-main hover:underline"
						>
							{folder.name}
						</button>
					</td>
					<td class="px-4 py-3 font-mono text-xs text-text-muted lg:px-6 lg:py-4 lg:text-sm"
						>{formatDate(folder.$createdAt)}</td
					>
					<td class="px-4 py-3 font-mono text-xs text-text-muted lg:px-6 lg:py-4 lg:text-sm">-</td>
					<td class="px-4 py-3 text-right lg:px-6 lg:py-4">
						<div class="flex justify-end gap-1 lg:gap-2">
							<button
								onclick={() => onDownload(folder.$id, folder.name, true)}
								class="rounded-md p-1.5 text-text-muted hover:bg-gray-100 hover:text-primary lg:p-2 dark:hover:bg-zinc-700"
								title="Download"
							>
								<DownloadSimple class="h-4 w-4 lg:h-5 lg:w-5" />
							</button>
							<button
								onclick={() => onRename(folder.$id, folder.name, true)}
								class="rounded-md p-1.5 text-text-muted hover:bg-gray-100 hover:text-text-main lg:p-2 dark:hover:bg-zinc-700"
								title="Rename"
							>
								<Pencil class="h-4 w-4 lg:h-5 lg:w-5" />
							</button>
							<button
								onclick={() => onDelete(folder.$id, folder.name, true)}
								class="rounded-md p-1.5 text-text-muted hover:bg-red-50 hover:text-red-600 lg:p-2 dark:hover:bg-red-900/20"
								title="Delete"
							>
								<Trash class="h-4 w-4 lg:h-5 lg:w-5" />
							</button>
						</div>
					</td>
				</tr>
			{/each}

			{#each files as file (file.$id)}
				<tr class="group transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800/50">
					<td class="px-4 py-3 lg:px-6 lg:py-4">
						<FileIcon class="h-5 w-5 text-blue-500 lg:h-6 lg:w-6 dark:text-blue-400" />
					</td>
					<td
						class="max-w-[300px] truncate px-4 py-3 text-text-main lg:max-w-[400px] lg:px-6 lg:py-4"
						title={file.name}
					>
						{file.name}
					</td>
					<td class="px-4 py-3 font-mono text-xs text-text-muted lg:px-6 lg:py-4 lg:text-sm"
						>{formatDate(file.$createdAt)}</td
					>
					<td class="px-4 py-3 font-mono text-xs text-text-muted lg:px-6 lg:py-4 lg:text-sm"
						>{formatFileSize(file.size)}</td
					>
					<td class="px-4 py-3 text-right lg:px-6 lg:py-4">
						<div class="flex justify-end gap-1 lg:gap-2">
							<button
								onclick={() => onDownload(file.$id, file.name, false)}
								class="rounded-md p-1.5 text-text-muted hover:bg-gray-100 hover:text-primary lg:p-2 dark:hover:bg-zinc-700"
								title="Download"
							>
								<DownloadSimple class="h-4 w-4 lg:h-5 lg:w-5" />
							</button>
							<button
								onclick={() => onRename(file.$id, file.name, false)}
								class="rounded-md p-1.5 text-text-muted hover:bg-gray-100 hover:text-text-main lg:p-2 dark:hover:bg-zinc-700"
								title="Rename"
							>
								<Pencil class="h-4 w-4 lg:h-5 lg:w-5" />
							</button>
							<button
								onclick={() => onDelete(file.$id, file.name, false)}
								class="rounded-md p-1.5 text-text-muted hover:bg-red-50 hover:text-red-600 lg:p-2 dark:hover:bg-red-900/20"
								title="Delete"
							>
								<Trash class="h-4 w-4 lg:h-5 lg:w-5" />
							</button>
						</div>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
