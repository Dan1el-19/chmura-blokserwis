<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Trash, ArrowCounterClockwise, File as FileIcon, Folder } from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';
	import { formatFileSize } from '$lib/utils/format';
	import Button from '$lib/components/ui/Button.svelte';

	let { data } = $props();

	let busyId = $state<string | null>(null);

	function formatDate(date: string) {
		return new Date(date).toLocaleString('pl-PL', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit'
		});
	}

	async function restore(id: string, name: string, isFolder: boolean) {
		busyId = id;
		try {
			const url = isFolder ? `/api/folders/${id}` : `/api/files/${id}`;
			const res = await fetch(url, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'restore' })
			});
			if (res.ok) {
				toast.success(`Przywrócono "${name}"`);
				await invalidateAll();
			} else {
				const body = await res.json().catch(() => ({}));
				toast.error(body.error || 'Nie udało się przywrócić');
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Błąd sieci');
		} finally {
			busyId = null;
		}
	}

	async function deletePermanent(id: string, name: string, isFolder: boolean) {
		if (
			!confirm(
				`Trwale usunąć "${name}"? Pliki zostaną wyczyszczone z bucketów i nie można ich będzie odzyskać.`
			)
		) {
			return;
		}
		busyId = id;
		try {
			const url = isFolder ? `/api/folders/${id}?permanent=true` : `/api/files/${id}?permanent=true`;
			const res = await fetch(url, { method: 'DELETE' });
			if (res.ok) {
				toast.success(`Trwale usunięto "${name}"`);
				await invalidateAll();
			} else {
				const body = await res.json().catch(() => ({}));
				toast.error(body.error || 'Nie udało się trwale usunąć');
			}
		} catch (e) {
			toast.error(e instanceof Error ? e.message : 'Błąd sieci');
		} finally {
			busyId = null;
		}
	}
</script>

<svelte:head>
	<title>Kosz | Chmura Blokserwis</title>
</svelte:head>

<div class="space-y-4">
	<header class="border-b border-border-line pb-4">
		<div class="flex items-center gap-3">
			<div class="rounded-full bg-red-100/50 p-2 dark:bg-red-900/30">
				<Trash class="h-5 w-5 text-red-500" weight="bold" />
			</div>
			<div>
				<h1 class="text-2xl font-bold tracking-tight text-text-main">Kosz</h1>
				<p class="text-sm text-text-muted">
					Pliki w koszu nie zajmują kwoty użytkownika do momentu trwałego usunięcia. Pliki nie są
					automatycznie usuwane — wyczyść je tutaj.
				</p>
			</div>
		</div>
	</header>

	{#if data.folders.length === 0 && data.files.length === 0}
		<div
			class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-line py-16 text-center"
		>
			<Trash class="h-10 w-10 text-text-muted/50" />
			<p class="text-sm text-text-muted">Kosz jest pusty</p>
		</div>
	{:else}
		<div class="overflow-hidden rounded-lg border border-border-line bg-bg-panel">
			<table class="w-full text-left text-sm">
				<thead
					class="border-b border-border-line bg-gray-50/50 font-medium text-text-muted dark:bg-zinc-900/50"
				>
					<tr>
						<th class="px-4 py-3">Nazwa</th>
						<th class="w-32 px-4 py-3">Rozmiar</th>
						<th class="w-44 px-4 py-3">Data</th>
						<th class="w-44 px-4 py-3 text-right">Akcje</th>
					</tr>
				</thead>
				<tbody class="divide-y divide-border-line">
					{#each data.folders as folder (folder.$id)}
						<tr class="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<Folder
										class="h-5 w-5 shrink-0 fill-amber-400 text-amber-600 dark:fill-amber-500/50 dark:text-amber-400"
									/>
									<span class="truncate font-medium text-text-main">{folder.name}</span>
								</div>
							</td>
							<td class="px-4 py-3 font-mono text-xs text-text-muted">—</td>
							<td class="px-4 py-3 font-mono text-xs text-text-muted">
								{formatDate(folder.$updatedAt)}
							</td>
							<td class="px-4 py-3">
								<div class="flex justify-end gap-2">
									<Button
										size="sm"
										variant="secondary"
										disabled={busyId === folder.$id}
										onclick={() => restore(folder.$id, folder.name, true)}
									>
										<ArrowCounterClockwise class="mr-1.5 h-3.5 w-3.5" />
										Przywróć
									</Button>
									<Button
										size="sm"
										variant="destructive"
										disabled={busyId === folder.$id}
										onclick={() => deletePermanent(folder.$id, folder.name, true)}
									>
										<Trash class="mr-1.5 h-3.5 w-3.5" />
										Usuń trwale
									</Button>
								</div>
							</td>
						</tr>
					{/each}

					{#each data.files as file (file.$id)}
						<tr class="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<FileIcon class="h-5 w-5 shrink-0 text-blue-500 dark:text-blue-400" />
									<span class="truncate text-text-main">{file.name}</span>
								</div>
							</td>
							<td class="px-4 py-3 font-mono text-xs text-text-muted">
								{formatFileSize(file.size)}
							</td>
							<td class="px-4 py-3 font-mono text-xs text-text-muted">
								{formatDate(file.$updatedAt)}
							</td>
							<td class="px-4 py-3">
								<div class="flex justify-end gap-2">
									<Button
										size="sm"
										variant="secondary"
										disabled={busyId === file.$id}
										onclick={() => restore(file.$id, file.name, false)}
									>
										<ArrowCounterClockwise class="mr-1.5 h-3.5 w-3.5" />
										Przywróć
									</Button>
									<Button
										size="sm"
										variant="destructive"
										disabled={busyId === file.$id}
										onclick={() => deletePermanent(file.$id, file.name, false)}
									>
										<Trash class="mr-1.5 h-3.5 w-3.5" />
										Usuń trwale
									</Button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}

	{#if data.error}
		<p class="text-sm text-red-500">{data.error}</p>
	{/if}
</div>
