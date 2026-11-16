<script lang="ts">
	import type { QuoteScopeSection } from '#lib/gen/unisource/v2/quotes_pb.js';
	import { button, primary } from './ui.js';
	let { current, proposal, stale, onapply, ondismiss }: { current: QuoteScopeSection[]; proposal: QuoteScopeSection[]; stale: boolean; onapply: () => void; ondismiss: () => void } = $props();
</script>
<section class="space-y-3 rounded-lg border border-primary/30 p-4" aria-label="Propozycja zakresu AI">
	<h3 class="font-semibold">Propozycja gotowa</h3>
	<div class="grid gap-3 md:grid-cols-2">
		<div><h4 class="font-medium">Obecny zakres</h4>{#each current as section (section)}<p class="mt-2 text-sm font-medium">{section.heading}</p><p class="whitespace-pre-wrap text-sm">{section.body}</p>{:else}<p class="text-sm text-text-muted">Brak zakresu.</p>{/each}</div>
		<div><h4 class="font-medium">Propozycja AI</h4>{#each proposal as section (section)}<p class="mt-2 text-sm font-medium">{section.heading}</p><p class="whitespace-pre-wrap text-sm">{section.body}</p>{:else}<p class="text-sm text-text-muted">Brak potwierdzonego zakresu.</p>{/each}</div>
	</div>
	{#if stale}<p role="status" class="text-sm">Szkic zmienił się od przygotowania propozycji. Nie można jej zastosować do tej wersji.</p>{/if}
	<div class="flex flex-wrap gap-2"><button type="button" class={primary} disabled={stale} onclick={onapply}>Zastosuj zakres</button><button type="button" class={button} onclick={ondismiss}>Zostaw obecny</button></div>
</section>
