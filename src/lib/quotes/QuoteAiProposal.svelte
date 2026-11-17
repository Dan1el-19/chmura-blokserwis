<script lang="ts">
	import QuoteMarkdown from './QuoteMarkdown.svelte';
	import type { QuoteScopeSection, QuoteLine, QuoteLineTextProposal } from '#lib/gen/unisource/v2/quotes_pb.js';
	import { button, primary } from './ui.js';

	let { current, proposal, stale, onapply, ondismiss, lines = [], proposedLines = [], showActions = true }: {
		current: QuoteScopeSection[];
		proposal: QuoteScopeSection[];
		stale: boolean;
		onapply: () => void;
		ondismiss: () => void;
		lines?: Pick<QuoteLine, 'name' | 'description'>[];
		proposedLines?: Pick<QuoteLineTextProposal, 'lineIndex' | 'name' | 'description'>[];
		showActions?: boolean;
	} = $props();

	const renames = $derived(proposedLines.filter(({ lineIndex, name }) =>
		lines[lineIndex] && lines[lineIndex].name !== name));
</script>

{#snippet sections(items: QuoteScopeSection[])}
	{#each items as section (section)}
		<div class="space-y-1">
			<h4 class="font-medium break-words">{section.heading}</h4>
			<QuoteMarkdown text={section.body} />
		</div>
	{/each}
{/snippet}

<section class="space-y-4 rounded-lg border border-primary/30 p-4" aria-labelledby="quote-solution-title">
	<h3 id="quote-solution-title" class="font-semibold">Opis rozwiązania i zakres prac</h3>
	{#if proposal.length}
		<div class="space-y-3">
			{@render sections(proposal)}
		</div>
		<details class="border-t border-border-line pt-3">
			<summary class="cursor-pointer text-sm font-medium">Porównaj z obecnym tekstem</summary>
			<div class="space-y-3 pt-3">
				{#if current.length}
					{@render sections(current)}
				{:else}
					<p class="text-sm text-text-muted">Obecnie wycena nie ma opisu rozwiązania.</p>
				{/if}
			</div>
		</details>
	{/if}
	{#if renames.length}
		<details class="border-t border-border-line pt-3">
			<summary class="cursor-pointer text-sm font-medium">Zmiany nazw pozycji</summary>
			<ul class="space-y-2 pt-3">
				{#each renames as line (line.lineIndex)}
					<li class="break-words text-sm">
						<span class="text-text-muted">{lines[line.lineIndex].name}</span>
						<span aria-hidden="true"> → </span>
						<span class="font-medium">{line.name}</span>
					</li>
				{/each}
			</ul>
		</details>
	{/if}
	{#if stale}
		<p role="status" class="text-sm">Szkic zmienił się od przygotowania propozycji. Nie można jej zastosować do tej wersji.</p>
	{/if}
	{#if showActions}
		<div class="flex flex-wrap gap-2">
			<button type="button" class={primary} disabled={stale} onclick={onapply}>Zastosuj propozycję</button>
			<button type="button" class={button} onclick={ondismiss}>Zostaw obecny</button>
		</div>
	{/if}
</section>
