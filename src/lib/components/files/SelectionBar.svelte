<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { DownloadSimple, Trash, X } from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';
	import type { SelectionState } from '$lib/modules/selection.svelte';

	let { selection, files, folders } = $props<{
		selection: SelectionState;
		files: Array<{ $id: string; name: string }>;
		folders: Array<{ $id: string; name: string }>;
	}>();

	async function deleteSelected() {
		if (!confirm(`Usunąć ${selection.count} element(ów)?`)) return;
		const ids = [...selection.selected];
		const fileIds = new Set(files.map((f) => f.$id));
		await Promise.all(
			ids.map((id) =>
				fetch(fileIds.has(id) ? `/api/files/${id}` : `/api/folders/${id}`, { method: 'DELETE' })
			)
		);
		toast.success(`Usunięto ${ids.length} element(ów)`);
		selection.clear();
		invalidateAll();
	}

	async function downloadSelected() {
		const fileIds = new Set(files.map((f) => f.$id));
		const selectedFiles = [...selection.selected].filter((id) => fileIds.has(id));
		if (selectedFiles.length === 0) {
			toast.info('Brak plików do pobrania (foldery są pomijane)');
			return;
		}
		for (const id of selectedFiles) {
			const file = files.find((f) => f.$id === id);
			if (!file) continue;
			const res = await fetch(`/api/files/${id}?download=true`);
			const data = await res.json();
			if (data.downloadUrl) {
				const a = document.createElement('a');
				a.href = `/api/proxy-download?url=${encodeURIComponent(data.downloadUrl)}&name=${encodeURIComponent(file.name)}`;
				a.download = file.name;
				a.click();
			}
		}
	}
</script>

<!-- Desktop: floating bottom bar -->
<div
	class="fixed bottom-6 left-1/2 z-40 hidden -translate-x-1/2 items-center gap-3 rounded-xl border border-border-line bg-bg-panel px-4 py-3 shadow-lg lg:flex"
>
	<span class="text-sm font-medium text-text-main">
		Zaznaczono: <strong>{selection.count}</strong>
	</span>
	<div class="h-4 w-px bg-border-line"></div>
	<button
		onclick={downloadSelected}
		class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-text-main hover:bg-gray-100 dark:hover:bg-zinc-700"
	>
		<DownloadSimple class="h-4 w-4" />
		Pobierz
	</button>
	<button
		onclick={deleteSelected}
		class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
	>
		<Trash class="h-4 w-4" />
		Usuń
	</button>
	<button
		onclick={() => selection.clear()}
		class="rounded-md p-1.5 text-text-muted hover:bg-gray-100 dark:hover:bg-zinc-700"
		aria-label="Anuluj zaznaczenie"
	>
		<X class="h-4 w-4" />
	</button>
</div>

<!-- Mobile: sticky top bar -->
<div
	class="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border-line bg-bg-panel px-4 py-2 lg:hidden"
>
	<div class="flex items-center gap-2">
		<button
			onclick={() => selection.clear()}
			class="rounded-md p-1.5 text-text-muted hover:bg-gray-100 dark:hover:bg-zinc-700"
			aria-label="Anuluj"
		>
			<X class="h-5 w-5" />
		</button>
		<span class="text-sm font-medium text-text-main">{selection.count} zaznaczonych</span>
	</div>
	<div class="flex items-center gap-1">
		<button
			onclick={downloadSelected}
			class="rounded-md p-2 text-text-muted hover:bg-gray-100 dark:hover:bg-zinc-700"
			aria-label="Pobierz"
		>
			<DownloadSimple class="h-5 w-5" />
		</button>
		<button
			onclick={deleteSelected}
			class="rounded-md p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
			aria-label="Usuń"
		>
			<Trash class="h-5 w-5" />
		</button>
	</div>
</div>
