<script lang="ts">
	import QuoteMarkdown from './QuoteMarkdown.svelte';
	import type { QuoteScopeSection, QuoteLine, QuoteLineTextProposal } from '#lib/gen/unisource/v2/quotes_pb.js';
	import { button, primary } from './ui.js';
	let { current, proposal, stale, onapply, ondismiss, lines = [], proposedLines = [], showActions = true }: { current: QuoteScopeSection[]; proposal: QuoteScopeSection[]; stale: boolean; onapply: () => void; ondismiss: () => void; lines?: Pick<QuoteLine, 'name'|'description'>[]; proposedLines?: Pick<QuoteLineTextProposal, 'lineIndex'|'name'|'description'>[]; showActions?: boolean } = $props();
</script>
<section class="space-y-3 rounded-lg border border-primary/30 p-4" aria-label="Propozycja zakresu AI">
	<h3 class="font-semibold">Propozycja gotowa</h3>
	{#if proposedLines.length}<div class="space-y-3" aria-label="Proponowane opisy pozycji">{#each proposedLines as line (line.lineIndex)}
 {#if lines[line.lineIndex]?.name !== line.name || lines[line.lineIndex]?.description !== line.description}
 <article class="rounded-lg border border-border-line p-3"><p class="font-medium break-words">{line.name}</p><QuoteMarkdown text={line.description}/><details class="mt-2 text-sm text-text-muted"><summary class="cursor-pointer">Porównaj z obecnym tekstem</summary><p class="mt-2 break-words">{lines[line.lineIndex]?.name}</p><p class="whitespace-pre-wrap break-words">{lines[line.lineIndex]?.description || 'Brak opisu.'}</p></details></article>
 {/if}
 {/each}</div>{/if}
 <div class="grid gap-3 md:grid-cols-2">
		<div><h4 class="font-medium">Obecny zakres</h4>{#each current as section (section)}<p class="mt-2 text-sm font-medium">{section.heading}</p><QuoteMarkdown text={section.body}/>{:else}<p class="text-sm text-text-muted">Brak zakresu.</p>{/each}</div>
		<div><h4 class="font-medium">Propozycja AI</h4>{#each proposal as section (section)}<p class="mt-2 text-sm font-medium">{section.heading}</p><QuoteMarkdown text={section.body}/>{:else}<p class="text-sm text-text-muted">Brak potwierdzonego zakresu.</p>{/each}</div>
	</div>
	{#if stale}<p role="status" class="text-sm">Szkic zmienił się od przygotowania propozycji. Nie można jej zastosować do tej wersji.</p>{/if}
	{#if showActions}<div class="flex flex-wrap gap-2"><button type="button" class={primary} disabled={stale} onclick={onapply}>{proposedLines.length ? 'Zastosuj propozycję' : 'Zastosuj zakres'}</button><button type="button" class={button} onclick={ondismiss}>Zostaw obecny</button></div>{/if}
</section>
