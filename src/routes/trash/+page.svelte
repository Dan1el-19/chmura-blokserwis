<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { Trash, ArrowCounterClockwise, File as FileIcon, Folder, DotsThreeVertical } from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';
	import { formatFileSize } from '$lib/utils/format';
	import Button from '$lib/components/ui/Button.svelte';
	import { swipeAction } from '$lib/actions/gestures';
	import BottomSheet from '$lib/components/ui/BottomSheet.svelte';

	let { data } = $props();

	let busyId = $state<string | null>(null);
	let sheetOpen = $state(false);
	let sheetTarget = $state<{ id: string; name: string; isFolder: boolean } | null>(null);

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

	function openSheet(id: string, name: string, isFolder: boolean) {
		sheetTarget = { id, name, isFolder };
		sheetOpen = true;
	}

	function closeSheet() {
		sheetOpen = false;
		sheetTarget = null;
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
		<!-- Mobile view -->
		<div class="space-y-2 select-none lg:hidden">
			{#each data.folders as folder (folder.$id)}
				<div class="relative overflow-hidden rounded-md border border-border-line bg-bg-panel">
					<div
						data-row-id={folder.$id}
						class="relative z-10 flex items-center gap-3 bg-bg-panel p-3"
						use:swipeAction={{
							threshold: 80,
							leftLabel: 'Usuń trwale',
							rightLabel: 'Przywróć',
							leftColor: '#dc2626',
							rightColor: '#16a34a',
							onSwipeLeft: () => deletePermanent(folder.$id, folder.name, true),
							onSwipeRight: () => restore(folder.$id, folder.name, true)
						}}
						role="button"
						tabindex="0"
					>
						<Folder
							class="h-8 w-8 shrink-0 fill-amber-400 text-amber-600 dark:fill-amber-500/50 dark:text-amber-400"
						/>
						<div class="min-w-0 flex-1">
							<p class="truncate text-sm font-medium text-text-main">{folder.name}</p>
							<p class="font-mono text-xs text-text-muted">{formatDate(folder.$updatedAt)}</p>
						</div>
						<button
							type="button"
							class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-800"
							aria-label="Akcje dla {folder.name}"
							onpointerdown={(e) => e.stopPropagation()}
							onclick={(e) => {
								e.stopPropagation();
								openSheet(folder.$id, folder.name, true);
							}}
						>
							<DotsThreeVertical class="h-5 w-5" weight="bold" />
						</button>
					</div>
				</div>
			{/each}

			{#each data.files as file (file.$id)}
				<div class="relative overflow-hidden rounded-md border border-border-line bg-bg-panel">
					<div
						data-row-id={file.$id}
						class="relative z-10 flex items-center gap-3 bg-bg-panel p-3"
						use:swipeAction={{
							threshold: 80,
							leftLabel: 'Usuń trwale',
							rightLabel: 'Przywróć',
							leftColor: '#dc2626',
							rightColor: '#16a34a',
							onSwipeLeft: () => deletePermanent(file.$id, file.name, false),
							onSwipeRight: () => restore(file.$id, file.name, false)
						}}
						role="button"
						tabindex="0"
					>
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
								openSheet(file.$id, file.name, false);
							}}
						>
							<DotsThreeVertical class="h-5 w-5" weight="bold" />
						</button>
					</div>
				</div>
			{/each}
		</div>

		<!-- Desktop view -->
		<div class="overflow-hidden rounded-lg border border-border-line bg-bg-panel hidden lg:block">
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

	<BottomSheet bind:open={sheetOpen} title={sheetTarget?.name}>
		{#if sheetTarget}
			{@const target = sheetTarget}
			<button
				type="button"
				class="flex h-12 w-full items-center gap-3 rounded-md px-4 text-left text-sm font-medium text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
				onclick={() => {
					closeSheet();
					restore(target.id, target.name, target.isFolder);
				}}
			>
				<span
					class="flex h-9 w-9 items-center justify-center rounded-full bg-green-100 text-green-600 dark:bg-green-900/40"
				>
					<ArrowCounterClockwise class="h-4 w-4" />
				</span>
				Przywróć
			</button>
			<div class="mx-4 my-1 border-t border-border-line"></div>
			<button
				type="button"
				class="flex h-12 w-full items-center gap-3 rounded-md px-4 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
				onclick={() => {
					closeSheet();
					deletePermanent(target.id, target.name, target.isFolder);
				}}
			>
				<span
					class="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/40"
				>
					<Trash class="h-4 w-4" />
				</span>
				Usuń trwale
			</button>
		{/if}
	</BottomSheet>

	{#if data.error}
		<p class="text-sm text-red-500">{data.error}</p>
	{/if}
</div>
