<script lang="ts">
	import { CheckCircle, CircleNotch, Globe, Sparkle, WarningCircle } from 'phosphor-svelte';
	import type { GetQuoteOperationResponse } from '#lib/gen/unisource/v2/quotes_pb.js';
	import { partialDescription, researchSources } from './ai-progress.js';

	let { operation }: { operation: GetQuoteOperationResponse } = $props();
	let active = $derived(operation.status === 'queued' || operation.status === 'running');
	let sections = $derived(partialDescription(operation.partialJson));
	let sources = $derived(researchSources(operation.searches));
	let headline = $derived(
		operation.status === 'queued' ? 'Przygotowuję generowanie' :
		operation.status === 'conflict' ? 'Szkic zmienił się podczas generowania' :
		operation.status === 'uncertain' ? 'Nie udało się potwierdzić wyniku' :
		operation.status === 'failed' ? 'Nie udało się wygenerować opisu' :
		operation.status === 'succeeded' ? 'Opis jest gotowy' :
		operation.researchStatus === 'searching' ? 'Szukam informacji o urządzeniach' :
		sections.length ? 'Piszę treść oferty' : 'Przygotowuję treść oferty'
	);
</script>

<div class="space-y-4 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm" aria-label="Praca asystenta AI">
	<div class="flex items-start gap-3" role="status">
		<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
			{#if active}<Sparkle size={20} class="motion-safe:animate-pulse" />{:else if operation.status === 'succeeded'}<CheckCircle size={20} />{:else}<WarningCircle size={20} />{/if}
		</div>
		<div class="min-w-0 pt-0.5">
			<p class="font-semibold text-text-main">{headline}{#if active}<span class="motion-safe:animate-pulse">…</span>{/if}</p>
			<p class="mt-0.5 text-xs text-text-muted">
				{#if operation.status === 'conflict'}Twoje zmiany pozostały bezpieczne. Możesz uruchomić generowanie ponownie.
				{:else if operation.status === 'uncertain'}Nowa próba może zostać ponownie rozliczona.
				{:else if operation.status === 'failed'}Możesz spróbować ponownie.{operation.errorCode ? ` Kod błędu: ${operation.errorCode}.` : ''}
				{:else if active}Możesz w tym czasie edytować szkic. Podgląd poniżej jest tymczasowy.
				{:else if operation.status === 'succeeded'}Sprawdź wygenerowany tekst w polach poniżej.
				{/if}
			</p>
		</div>
	</div>

	{#if operation.searches.length || operation.researchStatus === 'disabled' || operation.researchStatus === 'no_results'}
	<details open={active} class="space-y-3 border-t border-primary/15 pt-3">
		<summary class="cursor-pointer text-xs font-medium text-text-main">Szczegóły aktywności</summary>
	{#if operation.searches.length}
		<div class="space-y-2 border-t border-primary/15 pt-3">
			<p class="flex items-center gap-2 text-xs font-semibold text-text-main"><Globe size={16} /> Wyszukiwanie w internecie</p>
			<ul class="space-y-2">
				{#each operation.searches as search, index (index)}
					<li class="flex items-start gap-2 text-xs text-text-muted">
						{#if search.status === 'searching'}<CircleNotch size={15} class="mt-px shrink-0 motion-safe:animate-spin text-primary" />{:else}<CheckCircle size={15} class="mt-px shrink-0" />{/if}
						<span><span class="text-text-main">{search.item}</span> · {search.status === 'searching' ? 'szukam źródeł' : search.status === 'completed' ? `znaleziono źródła: ${search.sources.length}` : 'brak wyników lub wyszukiwanie niedostępne'}</span>
					</li>
				{/each}
			</ul>
		</div>
	{:else if operation.researchStatus === 'disabled' || operation.researchStatus === 'no_results'}
		<p class="text-xs text-text-muted">{operation.researchStatus === 'disabled' ? 'Wyszukiwanie internetowe jest niedostępne.' : 'Nie znaleziono źródeł lub wyszukiwanie było niedostępne.'} Opis powstaje na podstawie pozycji.</p>
	{/if}

	{#if sources.length}
		<details class="border-t border-primary/15 pt-3 text-xs">
			<summary class="cursor-pointer font-medium text-text-main">Źródła internetowe ({sources.length})</summary>
			<ul class="mt-2 space-y-2">
				{#each sources as source (source.url)}
					<li>
						<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
						<a href={source.url} target="_blank" rel="noopener noreferrer" class="break-words text-primary hover:underline">{source.title}</a>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
	</details>
	{/if}

	{#if active && sections.length}
		<div class="space-y-3 border-t border-primary/15 pt-3" aria-label="Powstający opis AI">
			<p class="text-xs font-semibold text-text-main">Powstająca treść</p>
			{#each sections as section, index (section.label)}
				<div class="rounded-lg border border-border-line bg-bg-panel p-3">
					<p class="mb-1 text-xs font-medium text-text-main">{section.label}</p>
					<p class="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">{section.text}{#if index === sections.length - 1}<span aria-hidden="true" class="text-primary motion-safe:animate-pulse"> ▍</span>{/if}</p>
				</div>
			{/each}
		</div>
	{/if}
</div>
