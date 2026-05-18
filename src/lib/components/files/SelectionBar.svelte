<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { DownloadSimple, Trash, X } from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';
	import { triggerDownload } from '$lib/utils/download';
	import type { SelectionState } from '$lib/modules/selection.svelte';

	let { selection, files, folders } = $props<{
		selection: SelectionState;
		files: Array<{ $id: string; name: string }>;
		folders: Array<{ $id: string; name: string }>;
	}>();

	type RowItem = { $id: string; name: string };

	async function deleteSelected() {
		if (!confirm(`Usunąć ${selection.count} element(ów)?`)) return;
		const ids = [...selection.selected];
		const fileIds = new Set(files.map((f: RowItem) => f.$id));

		// F2: track each item separately so a single failure doesn't mask the
		// rest. We surface failures with a granular toast and only invalidate
		// once at the end so the UI reflects whatever did succeed.
		const results = await Promise.allSettled(
			ids.map(async (id) => {
				const isFile = fileIds.has(id);
				const url = isFile ? `/api/files/${id}` : `/api/folders/${id}`;
				const res = await fetch(url, { method: 'DELETE' });
				if (!res.ok) {
					const body = await res.json().catch(() => ({}));
					throw new Error(body.error || `${res.status} ${res.statusText}`);
				}
				return id;
			})
		);

		const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
		const succeededCount = ids.length - failed.length;

		if (succeededCount > 0) {
			toast.success(`Usunięto ${succeededCount} element(ów)`);
		}
		if (failed.length > 0) {
			const sample = String((failed[0].reason as Error)?.message ?? 'błąd');
			toast.error(
				failed.length === 1
					? `Nie udało się usunąć: ${sample}`
					: `Nie udało się usunąć ${failed.length} z ${ids.length} elementów (${sample})`
			);
		}

		selection.clear();
		invalidateAll();
	}

	async function downloadSelected() {
		const fileIds = new Set(files.map((f: RowItem) => f.$id));
		const selectedFiles = [...selection.selected].filter((id) => fileIds.has(id));
		if (selectedFiles.length === 0) {
			toast.info('Brak plików do pobrania (foldery są pomijane)');
			return;
		}
		for (const id of selectedFiles) {
			const file = files.find((f: RowItem) => f.$id === id);
			if (!file) continue;
			const res = await fetch(`/api/files/${id}?download=true`);
			const data = await res.json();
			if (data.downloadUrl) {
				triggerDownload(data.downloadUrl, file.name);
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
