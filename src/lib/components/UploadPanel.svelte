<script lang="ts">
	import type { UploadManager, UploadTask } from '../upload-manager.svelte.js';
	import { EntryKind, SpaceKind, StorageLocation, type Space } from '../gen/unisourcecfl/catalog/v1/catalog_pb.js';
	let { manager, spaces = [], height = $bindable(0) }: { manager: UploadManager; spaces?: Pick<Space, 'id' | 'kind'>[]; height?: number } = $props();
	$effect(() => { if (!manager.tasks.length) height = 0; });
	const attentionCount = $derived(manager.tasks.filter((task) => ['error', 'needsFile', 'conflict'].includes(task.phase)).length);
	function destinationLabel(task: UploadTask): string {
		if (task.target.label !== task.target.spaceId) return task.target.label;
		const space = spaces.find((item) => item.id === task.target.spaceId);
		const name = space?.kind === SpaceKind.SHARED ? 'Main' : space?.kind === SpaceKind.PRIVATE ? 'Pliki prywatne' : 'Wybrana przestrzeń';
		return task.target.parentId ? `${name} / Wybrany folder` : name;
	}
	const locationLabel = (location: StorageLocation | undefined) =>
		location === StorageLocation.R2 ? 'R2' : location === StorageLocation.RUSTFS ? 'RustFS' : '';
	const retryLocations = $derived([...new Set(manager.tasks.filter((task) => task.phase === 'retrying').map((task) => locationLabel(task.storageLocation) || 'magazyn'))]);
	function phaseLabel(task: UploadTask): string {
		switch (task.phase) {
			case 'queued':
				return 'W kolejce';
			case 'conflict':
				return 'Nazwa jest już zajęta';
			case 'needsFile':
				return 'Wybierz plik, aby wznowić';
			case 'paused':
				return 'Wstrzymano';
			case 'checksum':
				return 'Obliczanie sumy kontrolnej';
			case 'preparing':
				return 'Przygotowanie transferu';
			case 'uploading':
				return `Wysyłanie do ${locationLabel(task.storageLocation) || 'magazynu'}`;
			case 'retrying':
				return `Ponawiam w ${locationLabel(task.storageLocation) || 'magazynie'}`;
			case 'finalizing':
				return 'Kończenie transferu';
			case 'verifying':
				return 'Weryfikacja pliku';
			case 'done':
				return 'Przesłano';
			case 'cancelled':
				return 'Anulowano';
			case 'error':
				return 'Wystąpił błąd';
		}
	}
</script>

{#if manager.tasks.length}
	<section
		bind:offsetHeight={height}
		class="fixed right-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-3 z-10 rounded-lg border border-border-line bg-bg-panel shadow-xl sm:left-auto sm:w-96"
		aria-label="Transfery"
	>
		<div class="flex items-center justify-between gap-2 border-b border-border-line px-4 py-3">
			<button
				type="button"
				class="font-semibold text-text-main"
				aria-expanded={!manager.collapsed}
				aria-controls={manager.collapsed ? undefined : 'transfer-list'}
				onclick={() => (manager.collapsed = !manager.collapsed)}
				>Transfery{manager.pendingCount ? ` · ${manager.pendingCount} w toku` : attentionCount ? '' : ' — zakończone'}{attentionCount ? ` · ${attentionCount} wymaga uwagi` : ''}{retryLocations.length ? ` · Ponawianie: ${retryLocations.join(', ')}` : ''}</button
			>
			<button
				type="button"
				class="rounded px-2 py-1 text-xs text-text-muted"
				onclick={() => (manager.collapsed = !manager.collapsed)}
				>{manager.collapsed ? 'Rozwiń' : 'Zwiń'}</button
			>
		</div>
		{#if !manager.collapsed}
			<div id="transfer-list" class="max-h-[45dvh] divide-y divide-border-line overflow-y-auto">
				{#each manager.tasks as task (task.id)}
					<div class="space-y-2 px-4 py-3">
						<div class="flex flex-wrap items-center gap-x-2 gap-y-1">
							<strong class="min-w-0 basis-full truncate text-sm text-text-main" title={task.name}
								>{task.name}</strong
							>
							{#if task.multipartLocalId && task.phase === 'needsFile'}
								<label class="cursor-pointer whitespace-nowrap rounded px-2 py-1 text-xs text-primary underline">
									Wybierz plik
									<input
										type="file"
										class="sr-only"
										aria-label={`Wybierz plik do wznowienia: ${task.name}`}
										onchange={(event) => {
											const input = event.currentTarget as HTMLInputElement;
											const file = input.files?.[0];
											input.value = '';
											if (file) manager.resume(task.id, file);
										}}
									/>
								</label>
							{:else if task.multipartLocalId && ['paused', 'error'].includes(task.phase) && task.file}
								<button type="button" class="rounded px-2 py-1 text-xs text-primary" onclick={() => manager.resume(task.id)}>Wznów</button>
							{/if}
							{#if task.multipartLocalId && ['queued', 'preparing', 'uploading', 'retrying', 'verifying'].includes(task.phase)}
								<button type="button" class="rounded px-2 py-1 text-xs text-text-muted" onclick={() => manager.pause(task.id)}>Wstrzymaj</button>
							{/if}
							{#if !['done', 'cancelled'].includes(task.phase)}<button
									type="button"
									class="rounded px-2 py-1 text-xs text-text-muted hover:text-red-600"
									onclick={() => manager.cancel(task.id)}
									aria-label={manager.pendingCount > 1 ? `Anuluj ${task.name}` : 'Anuluj'}
									>Anuluj</button
								>{/if}
						</div>
						<p class="truncate text-xs text-text-muted" title={destinationLabel(task)}>
							{destinationLabel(task)}
						</p>
						<p class="text-xs {task.phase === 'done' ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-text-muted'}" role="status">{phaseLabel(task)}</p>
						{#if task.storageLocation}<p class="text-xs text-text-muted">
								Miejsce: {locationLabel(task.storageLocation)}
							</p>{/if}
						{#if ['checksum', 'uploading', 'retrying', 'finalizing', 'verifying', 'done'].includes(task.phase)}<div
								class="h-1.5 overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800"
								role="progressbar"
								aria-label={`Postęp ${task.name}`}
								aria-valuenow={task.progress}
								aria-valuemin="0"
								aria-valuemax="100"
							>
								<span
									class="block h-full transition-[width] motion-reduce:transition-none {task.phase === 'done' ? 'bg-emerald-500' : 'bg-primary'}"
									style={`width:${task.progress}%`}
								></span>
							</div>{/if}
						{#if task.phase === 'done'}<p class="sr-only">Plik został przesłany.</p>{/if}
						{#if task.phase === 'conflict'}
							<div class="flex flex-wrap gap-2">
								<button type="button" class="rounded border border-border-line px-2 py-1 text-xs" onclick={() => void manager.resolveConflict(task.id, 'keep')}>Zachowaj oba</button>
								{#if task.conflictEntry?.kind === EntryKind.FILE}<button type="button" class="rounded border border-border-line px-2 py-1 text-xs" onclick={() => void manager.resolveConflict(task.id, 'replace')}>Zastąp</button>{/if}
								<button type="button" class="rounded px-2 py-1 text-xs" onclick={() => void manager.resolveConflict(task.id, 'skip')}>Pomiń</button>
							</div>
						{/if}
						{#if task.error}<p class="text-xs text-red-600 dark:text-red-300" role="alert">
								{task.error}
							</p>{/if}
					</div>
				{/each}
			</div>
			<div class="flex justify-end gap-2 border-t border-border-line p-2">
				{#if manager.pendingCount}<button
						type="button"
						class="rounded px-3 py-2 text-xs text-red-600"
						onclick={() => manager.cancelAll()}>Anuluj wszystkie</button
					>{/if}
				<button
					type="button"
					class="rounded px-3 py-2 text-xs text-text-muted"
					onclick={() => manager.clearFinished()}>Wyczyść zakończone</button
				>
			</div>
		{/if}
	</section>
{/if}
