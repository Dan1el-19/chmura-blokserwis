<script lang="ts">
	import { create } from '@bufbuild/protobuf';
	import { QuoteLineSchema, type QuoteLine } from '#lib/gen/unisource/v2/quotes_pb.js';
	import { button, field } from './ui.js';

	let { lines = $bindable(), sourceRows = $bindable([]), onchange, net = false }: {
		lines: QuoteLine[];
		sourceRows?: number[];
		onchange: () => void;
		net?: boolean;
	} = $props();

	function add() {
		lines = [...lines, create(QuoteLineSchema, { quantity: '1', unitPrice: '0' })];
		onchange();
	}

	function remove(index: number) {
		lines = lines.filter((_, i) => i !== index);
		sourceRows = sourceRows.filter((_, i) => i !== index);
		onchange();
	}
</script>

<div class="space-y-3">
	{#each lines as line, index (line)}
		<div class="space-y-2 border-b border-border-line pb-3">
			<div class="flex items-center justify-between gap-3">
				<span class="text-sm text-text-muted">Pozycja {index + 1}{sourceRows[index] ? ` · Wiersz ${sourceRows[index]} w arkuszu` : ''}</span>
				<button class={button} type="button" aria-label={`Usuń pozycję ${index + 1}`} onclick={() => remove(index)}>Usuń</button>
			</div>
			<div class="grid grid-cols-2 gap-3 lg:grid-cols-[3fr_1fr_1fr]">
				<label class="col-span-2 text-sm lg:col-span-1">Nazwa<input class={field} aria-label={`Nazwa pozycji ${index + 1}`} bind:value={line.name} oninput={onchange} /></label>
				<label class="text-sm">Ilość<input class={field} aria-label={`Ilość pozycji ${index + 1}`} bind:value={line.quantity} inputmode="decimal" oninput={onchange} /></label>
				<label class="text-sm">Cena {net ? 'netto' : 'brutto'}<input class={field} aria-label={`Cena ${net ? 'netto' : 'brutto'} pozycji ${index + 1}`} bind:value={line.unitPrice} inputmode="decimal" oninput={onchange} /></label>
			</div>
		</div>
	{/each}
	<button class={button} type="button" onclick={add}>Dodaj pozycję</button>
</div>
