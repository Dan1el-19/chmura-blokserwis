<script lang="ts">
	import { create } from '@bufbuild/protobuf';
	import { QuoteLineSchema, type QuoteLine } from '#lib/gen/unisource/v2/quotes_pb.js';
	import { button, field, formatQuoteLineValue } from './ui.js';

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
	<div class="lines-container">
		<table aria-label="Pozycje wyceny">
			<thead><tr><th>Nazwa</th><th>Ilość</th><th>Cena {net ? 'netto' : 'brutto'}</th><th>Wartość</th><th><span class="sr-only">Akcje</span></th></tr></thead>
			<tbody>
				{#each lines as line, index (line)}
					<tr>
						<td class="name"><label><span class="mobile-label">Pozycja {index + 1} · Nazwa</span><input class={field} aria-label={`Nazwa pozycji ${index + 1}`} bind:value={line.name} oninput={onchange} /></label>{#if sourceRows[index]}<span class="source-row">Wiersz {sourceRows[index]} w arkuszu</span>{/if}</td>
						<td><label><span class="mobile-label">Ilość</span><input class={field} aria-label={`Ilość pozycji ${index + 1}`} bind:value={line.quantity} inputmode="decimal" oninput={onchange} /></label></td>
						<td><label><span class="mobile-label">Cena {net ? 'netto' : 'brutto'}</span><input class={field} aria-label={`Cena ${net ? 'netto' : 'brutto'} pozycji ${index + 1}`} bind:value={line.unitPrice} inputmode="decimal" oninput={onchange} /></label></td>
						<td class="value"><span class="mobile-label">Wartość: </span><span>{formatQuoteLineValue(line.quantity, line.unitPrice)}</span></td>
						<td class="remove"><button class={button} type="button" aria-label={`Usuń pozycję ${index + 1}`} onclick={() => remove(index)}>Usuń</button></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
	<button class={button} type="button" onclick={add}>Dodaj pozycję</button>
</div>

<style>
	.lines-container { container-type: inline-size; }
	table, tbody { display: block; width: 100%; }
	thead { display: none; }
	tr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.375rem 0.75rem; padding: 0.25rem 0; border-bottom: 1px solid var(--color-border-line); }
	td { min-width: 0; }
	.name { grid-column: 1 / -1; }
	.mobile-label { display: block; font-size: 0.875rem; }
	.source-row { display: block; font-size: 0.75rem; }
	.value { align-self: center; font-size: 0.875rem; overflow-wrap: anywhere; }
	.value .mobile-label { display: inline; }
	.remove { text-align: right; }
	@container (min-width: 480px) {
		table { display: table; table-layout: fixed; border-collapse: collapse; }
		thead { display: table-header-group; }
		tbody { display: table-row-group; }
		tr { display: table-row; }
		th, td { padding: 0.375rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--color-border-line); }
		th { font-size: 0.875rem; font-weight: 500; }
		th:first-child { width: 28%; }
		th:nth-child(2) { width: 14%; }
		th:nth-child(3) { width: 18%; }
		th:nth-child(4) { width: 20%; }
		th:last-child { width: 70px; }
		.mobile-label { display: none; }
		.value .mobile-label { display: none; }
	}
</style>
