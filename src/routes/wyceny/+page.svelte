<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import { onMount, untrack } from 'svelte';
	import type { Quotation } from '@unisource/sdk/v2';
	import {
		Archive,
		ArrowCounterClockwise,
		Copy,
		FilePlus,
		FileText,
		MagnifyingGlass
	} from 'phosphor-svelte';
	import {
		listLocalQuotationDrafts,
		removeLocalQuotationDraft,
		type LocalQuotationDraft
	} from '$lib/quotations/local-drafts';
	import { sortQuotations } from '$lib/quotations/list';

	let { data } = $props();
	let search = $state(untrack(() => data.filters?.search ?? ''));
	let status = $state(untrack(() => data.filters?.status ?? ''));
	let year = $state(untrack(() => data.filters?.year?.toString() ?? ''));
	let busyId = $state('');
	let errorMessage = $state('');
	let localDrafts = $state<LocalQuotationDraft[]>([]);
	let migrating = $state(false);
	let sortedList = $derived(sortQuotations(data.quotations.items));
	let list = $derived(sortedList.filter((quotation) => quotation.status !== 'archived'));
	let archivedList = $derived(sortedList.filter((quotation) => quotation.status === 'archived'));
	let cursor = $derived(data.quotations.page.next_cursor);
	const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });
	const date = new Intl.DateTimeFormat('pl-PL', { dateStyle: 'medium', timeStyle: 'short' });

	onMount(() => {
		localDrafts = listLocalQuotationDrafts(window.localStorage);
	});
	function applyFilters(event: SubmitEvent) {
		event.preventDefault();
		const params = new URLSearchParams();
		if (search.trim()) params.set('search', search.trim());
		if (status) params.set('status', status);
		if (year) params.set('year', year);
		void goto(`/wyceny${params.size ? `?${params}` : ''}`);
	}
	async function action(
		id: string,
		actionName: 'duplicate' | 'archive' | 'restore',
		lockVersion: number
	) {
		busyId = id;
		errorMessage = '';
		try {
			const response = await fetch(`/api/quotations/${encodeURIComponent(id)}/${actionName}`, {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({
					expectedLockVersion: lockVersion,
					idempotencyKey: crypto.randomUUID()
				})
			});
			if (!response.ok)
				throw new Error(
					(await response.json().catch(() => ({}))).message ?? 'Operacja nie powiodła się.'
				);
			await invalidateAll();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Operacja nie powiodła się.';
		} finally {
			busyId = '';
		}
	}
	async function migrateDrafts() {
		if (migrating || localDrafts.length === 0) return;
		migrating = true;
		errorMessage = '';
		try {
			for (const draft of localDrafts) {
				const response = await fetch('/api/quotations', {
					method: 'POST',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ localDraft: draft, idempotencyKey: `local-${draft.id}` })
				});
				if (!response.ok) throw new Error(`Nie udało się przenieść szkicu „${draft.title}”.`);
				removeLocalQuotationDraft(window.localStorage, draft.id);
			}
			localDrafts = [];
			await invalidateAll();
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : 'Migracja szkiców nie powiodła się.';
		} finally {
			migrating = false;
		}
	}
</script>

<svelte:head
	><title>Wyceny — Chmura Blokserwis</title><meta
		name="description"
		content="Tworzenie i zarządzanie wycenami firmowymi Blokserwis."
	/></svelte:head
>

<div class="mx-auto max-w-7xl space-y-5">
	<header class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
		<div>
			<h1 class="text-2xl font-bold tracking-tight text-text-main">Wyceny</h1>
			<p class="mt-1 text-sm text-text-muted">
				Twórz, dopracowuj z AI i zatwierdzaj dokumenty ofertowe.
			</p>
		</div>
		<a
			href="/wyceny/nowa"
			class="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white shadow-sm hover:bg-primary/90 sm:h-10"
			><FilePlus class="h-4 w-4" weight="bold" /> Nowa wycena</a
		>
	</header>
	{#if errorMessage}<div
			class="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
		>
			{errorMessage}
		</div>{/if}
	{#if localDrafts.length > 0}<section
			class="flex flex-col gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/30 dark:text-blue-200 sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<p class="text-sm font-medium">Znaleziono {localDrafts.length} lokalnych szkiców</p>
				<p class="mt-1 text-xs opacity-80">
					Zostaną usunięte z przeglądarki dopiero po potwierdzonym przeniesieniu do UniSource.
				</p>
			</div>
			<button
				type="button"
				disabled={migrating}
				onclick={migrateDrafts}
				class="h-10 rounded-md bg-primary px-4 text-sm font-medium text-white disabled:opacity-50"
				>{migrating ? 'Przenoszenie…' : 'Przenieś do UniSource'}</button
			>
		</section>{/if}
	<form
		onsubmit={applyFilters}
		class="grid gap-2 rounded-md border border-border-line bg-bg-panel p-3 sm:grid-cols-[minmax(14rem,1fr)_11rem_8rem_auto]"
	>
		<label class="relative"
			><span class="sr-only">Szukaj wyceny</span><MagnifyingGlass
				class="pointer-events-none absolute top-3 left-3 h-4 w-4 text-text-muted"
			/><input
				bind:value={search}
				placeholder="Numer, klient lub tytuł"
				class="h-10 w-full rounded-md border border-border-line bg-bg-app pr-3 pl-9 text-sm text-text-main"
			/></label
		><label
			><span class="sr-only">Status</span><select
				bind:value={status}
				class="h-10 w-full rounded-md border border-border-line bg-bg-app px-3 text-sm text-text-main"
				><option value="">Wszystkie statusy</option><option value="draft">Szkice</option><option
					value="approved">Zatwierdzone</option
				></select
			></label
		><label
			><span class="sr-only">Rok</span><input
				bind:value={year}
				inputmode="numeric"
				pattern="[0-9]{4}"
				placeholder="Rok"
				class="h-10 w-full rounded-md border border-border-line bg-bg-app px-3 text-sm text-text-main"
			/></label
		><button
			class="h-10 rounded-md border border-border-line bg-bg-app px-4 text-sm font-medium text-text-main hover:bg-gray-100 dark:hover:bg-zinc-800"
			>Filtruj</button
		>
	</form>
	{#snippet quotationTable(quotations: Quotation[])}
		<table class="w-full min-w-230 text-left text-sm">
			<thead class="bg-bg-app text-xs text-text-muted">
				<tr>
					<th class="px-4 py-3 font-medium">Numer / tytuł</th>
					<th class="px-4 py-3 font-medium">Klient</th>
					<th class="px-4 py-3 text-right font-medium">Wartość brutto</th>
					<th class="px-4 py-3 font-medium">Status</th>
					<th class="px-4 py-3 font-medium">Autor</th>
					<th class="px-4 py-3 font-medium">Aktualizacja</th>
					<th class="px-3 py-3"><span class="sr-only">Akcje</span></th>
				</tr>
			</thead>
			<tbody>
				{#each quotations as quotation (quotation.id)}
					<tr class="border-t border-border-line">
						<td class="px-4 py-3">
							<a
								href="/wyceny/{quotation.id}"
								class="font-medium text-text-main hover:text-primary hover:underline"
								>{quotation.document.number ?? 'Szkic'} · {quotation.document.title}</a
							>
						</td>
						<td class="px-4 py-3 text-text-muted"
							>{quotation.document.customer?.companyName ?? '—'}</td
						>
						<td class="px-4 py-3 text-right font-mono text-text-main">
							{money.format(quotation.document.totalGrossCents / 100)}
						</td>
						<td class="px-4 py-3">
							<span
								class="rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-text-muted dark:bg-zinc-800"
								>{quotation.status === 'approved'
									? 'Zatwierdzona'
									: quotation.status === 'archived'
										? 'Archiwalna'
										: 'Szkic'}</span
							>
						</td>
						<td class="px-4 py-3 text-xs text-text-muted"
							>{quotation.updatedBy ?? quotation.createdBy}</td
						>
						<td class="px-4 py-3 text-xs text-text-muted"
							>{date.format(new Date(quotation.updatedAt))}</td
						>
						<td class="px-3 py-2">
							<div class="flex justify-end gap-1">
								<button
									type="button"
									disabled={busyId === quotation.id}
									onclick={() => action(quotation.id, 'duplicate', quotation.lockVersion)}
									class="flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-bg-app hover:text-primary disabled:opacity-50"
									aria-label="Duplikuj wycenę"><Copy class="h-4 w-4" /></button
								>
								{#if quotation.status === 'archived'}
									<button
										type="button"
										disabled={busyId === quotation.id}
										onclick={() => action(quotation.id, 'restore', quotation.lockVersion)}
										class="flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-bg-app hover:text-primary disabled:opacity-50"
										aria-label="Przywróć wycenę"><ArrowCounterClockwise class="h-4 w-4" /></button
									>
								{:else}
									<button
										type="button"
										disabled={busyId === quotation.id}
										onclick={() => action(quotation.id, 'archive', quotation.lockVersion)}
										class="flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-bg-app hover:text-primary disabled:opacity-50"
										aria-label="Archiwizuj wycenę"><Archive class="h-4 w-4" /></button
									>
								{/if}
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/snippet}

	{#if list.length === 0}
		<section
			class="rounded-md border border-dashed border-border-line bg-bg-panel px-6 py-12 text-center"
		>
			<FileText class="mx-auto h-9 w-9 text-text-muted" />
			<h2 class="mt-4 text-base font-semibold text-text-main">
				Brak aktywnych wycen dla tych filtrów
			</h2>
			<p class="mx-auto mt-1 max-w-md text-sm text-text-muted">
				Utwórz nową wycenę ręcznie albo zacznij od importu XLSX.
			</p>
			<a
				href="/wyceny/nowa"
				class="mt-5 inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-white"
				>Utwórz wycenę</a
			>
		</section>
	{:else}
		<section class="overflow-x-auto rounded-md border border-border-line bg-bg-panel">
			{@render quotationTable(list)}
		</section>
	{/if}

	<details class="rounded-md border border-border-line bg-bg-panel">
		<summary
			class="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-text-main [&::-webkit-details-marker]:hidden"
		>
			<span class="flex items-center gap-2"
				><Archive class="h-4 w-4 text-text-muted" />Archiwum ({archivedList.length})</span
			>
			<span class="text-xs font-normal text-text-muted">Rozwiń</span>
		</summary>
		{#if archivedList.length > 0}
			<div class="overflow-x-auto border-t border-border-line">
				{@render quotationTable(archivedList)}
			</div>
		{:else}
			<p class="border-t border-border-line px-4 py-4 text-sm text-text-muted">
				Brak zarchiwizowanych wycen.
			</p>
		{/if}
	</details>
	{#if cursor}<a
			href="?cursor={encodeURIComponent(cursor)}"
			class="inline-flex h-10 items-center rounded-md border border-border-line bg-bg-panel px-4 text-sm font-medium text-text-main"
			>Następna strona</a
		>{/if}
</div>
