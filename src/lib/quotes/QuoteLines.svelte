<script lang="ts">
	import { create } from '@bufbuild/protobuf';
	import { QuoteLineSchema, QuoteVatKind, type QuoteLine } from '#lib/gen/unisource/v2/quotes_pb.js';
	import { button, field } from './ui.js';

	let { lines = $bindable(), sourceRows = $bindable([]), onchange }: {
		lines: QuoteLine[];
		sourceRows?: number[];
		onchange: () => void;
	} = $props();
	let selected = $state<number[]>([]);
	let vat = $state('23');

	function add() {
		lines = [...lines, create(QuoteLineSchema, { quantity: '1', unitPrice: '0' })];
		onchange();
	}

	function remove(index: number) {
		lines = lines.filter((_, i) => i !== index);
		sourceRows = sourceRows.filter((_, i) => i !== index);
		selected = [];
		onchange();
	}

	function setVAT() {
		for (const index of selected) {
			const line = lines[index];
			if (!line) continue;
			line.vatKind = QuoteVatKind.RATE;
			line.vatPercent = vat;
		}
		onchange();
	}
</script>

<div class="space-y-3">
	<div class="flex flex-wrap items-end gap-2">
		<button class={button} type="button" onclick={add}>Dodaj pozycję</button>
		<button class={button} type="button" onclick={() => selected = lines.map((_, i) => i)}>Zaznacz wszystkie</button>
		<label class="w-28 text-sm">Stawka VAT (%)<input class={field} bind:value={vat} inputmode="decimal" /></label>
		<button class={button} type="button" onclick={setVAT} disabled={selected.length === 0}>Ustaw VAT zaznaczonym</button>
	</div>
	{#each lines as line, index (line)}
		<div class="grid items-end gap-2 rounded-md border border-border-line p-3 sm:grid-cols-2 lg:grid-cols-[auto_3fr_1fr_1fr_1fr_1fr_auto]">
			<label class="text-xs">
				<input type="checkbox" aria-label={`Zaznacz pozycję ${index + 1}`} checked={selected.includes(index)}
					onchange={(event) => selected = event.currentTarget.checked ? [...selected, index] : selected.filter((i) => i !== index)} />
				{sourceRows[index] ? `Wiersz ${sourceRows[index]}` : index + 1}
			</label>
			<label class="text-xs">Nazwa<input class={field} bind:value={line.name} oninput={onchange} /></label>
			<label class="text-xs">Ilość<input class={field} bind:value={line.quantity} inputmode="decimal" oninput={onchange} /></label>
			<label class="text-xs">Cena<input class={field} bind:value={line.unitPrice} inputmode="decimal" oninput={onchange} /></label>
			<label class="text-xs">VAT
				<select class={field} bind:value={line.vatKind} onchange={() => {
					if (line.vatKind !== QuoteVatKind.RATE) line.vatPercent = '';
					else if (!line.vatPercent) line.vatPercent = '23';
					onchange();
				}}>
					<option value={QuoteVatKind.UNSPECIFIED}>Uzupełnij</option>
					<option value={QuoteVatKind.RATE}>Stawka %</option>
					<option value={QuoteVatKind.EXEMPT}>Zwolniony</option>
					<option value={QuoteVatKind.OUT_OF_SCOPE}>Nie podlega</option>
				</select>
			</label>
			{#if line.vatKind === QuoteVatKind.RATE}
				<label class="text-xs">Stawka (%)<input class={field} bind:value={line.vatPercent} inputmode="decimal" oninput={onchange} /></label>
			{/if}
			<button class={button} type="button" onclick={() => remove(index)}>Usuń</button>
		</div>
	{/each}
</div>
