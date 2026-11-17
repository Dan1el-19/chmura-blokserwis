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

	let expanded = $state<number | null>(null);

	function add() {
		expanded = lines.length;
		lines = [...lines, create(QuoteLineSchema, { quantity: '1', unitPrice: '0' })];
		onchange();
	}

	function remove(index: number) {
		if (expanded === index) expanded = null;
		else if (expanded !== null && expanded > index) expanded--;
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
					<tr class:collapsed={expanded !== index}>
						<td class="line-summary"><button type="button" aria-label={`Edytuj pozycję ${index + 1}: ${line.name || 'Nowa pozycja'}`} aria-expanded={expanded === index} onclick={() => expanded = expanded === index ? null : index}><span><strong>{line.name || 'Nowa pozycja'}</strong><small>{line.quantity} × {line.unitPrice} zł</small></span><span>{formatQuoteLineValue(line.quantity, line.unitPrice)} <span aria-hidden="true">›</span></span></button></td>
						<td class="name"><label><span class="mobile-label">Pozycja {index + 1} · Nazwa</span><input class={field} aria-label={`Nazwa pozycji ${index + 1}`} bind:value={line.name} oninput={onchange} /></label><details class="line-description"><summary>Opis pozycji</summary><label><span class="sr-only">Opis (opcjonalnie)</span><textarea class={field} rows="2" aria-label={`Opis pozycji ${index + 1}`} bind:value={line.description} oninput={onchange}></textarea></label></details>{#if sourceRows[index]}<span class="source-row">Wiersz {sourceRows[index]} w arkuszu</span>{/if}</td>
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
	.line-summary { grid-column: 1 / -1; }
	.line-summary button { display: flex; width: 100%; min-height: 3.5rem; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.5rem 0; text-align: left; }
	.line-summary button > span:first-child { min-width: 0; overflow-wrap: anywhere; }
	.line-summary button > span:last-child { flex-shrink: 0; font-size: 0.875rem; font-weight: 600; }
	.line-summary strong, .line-summary small { display: block; }
	.line-summary strong { font-size: 0.875rem; font-weight: 600; }
	.line-summary small { margin-top: 0.15rem; color: var(--color-text-muted); font-size: 0.75rem; }
	tr.collapsed td:not(.line-summary) { display: none; }
	tr { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 0.375rem 0.75rem; padding: 0.25rem 0; border-bottom: 1px solid var(--color-border-line); }
	td { min-width: 0; }
	.name { grid-column: 1 / -1; }
	.mobile-label { display: block; margin-bottom: 0.375rem; font-size: 0.875rem; }
	.source-row { display: block; font-size: 0.75rem; }
	.line-description summary { cursor: pointer; padding: .25rem 0; font-weight: 500; }
	.line-description { display: block; gap: 0.25rem; margin-top: 0.5rem; font-size: 0.75rem; color: var(--color-text-muted); }
	.value { align-self: center; font-size: 0.875rem; overflow-wrap: anywhere; }
	.value .mobile-label { display: inline; margin: 0; }
	.remove { text-align: right; }
	@container (min-width: 440px) {
		table { display: table; table-layout: fixed; border-collapse: collapse; }
		thead { display: table-header-group; }
		.line-summary { display: none; }
		tr.collapsed td:not(.line-summary) { display: table-cell; }
		tbody { display: table-row-group; }
		tr { display: table-row; }
		th, td { padding: 0.375rem; text-align: left; vertical-align: top; border-bottom: 1px solid var(--color-border-line); }
		th { font-size: 0.875rem; font-weight: 500; }
		.value { font-size: 0.875rem; white-space: nowrap; }
		.remove button { display: inline-flex; align-items: center; justify-content: center; }
		th:first-child { width: 44%; }
		th:nth-child(2) { width: 12%; }
		th:nth-child(3) { width: 16%; }
		th:nth-child(4) { width: 18%; }
		th:last-child { width: 70px; }
		.mobile-label { display: none; }
		.value .mobile-label { display: none; }
	}
</style>
