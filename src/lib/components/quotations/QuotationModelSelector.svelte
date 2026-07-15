<script lang="ts">
	type Model = {
		id: string;
		name: string;
		description?: string;
		promptPriceUsd?: string;
		completionPriceUsd?: string;
		recommended?: boolean;
		available?: boolean;
	};
	type Usage = {
		quotationCostUsdMicros?: number;
		monthCostUsdMicros?: number;
		operations?: number;
	};
	type Props = {
		models?: Model[];
		value: string;
		usage?: Usage | null;
		estimatedCostUsd?: number | null;
		onchange: (id: string) => void;
	};
	let { models = [], value, usage = null, estimatedCostUsd = 0, onchange }: Props = $props();
	const usd = new Intl.NumberFormat('pl-PL', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 4
	});
</script>

<div class="grid gap-2">
	<label class="grid gap-1 text-sm font-medium text-text-main"
		>Model AI
		<select
			{value}
			onchange={(event) => onchange(event.currentTarget.value)}
			class="h-10 rounded-md border border-border-line bg-bg-app px-3 text-sm text-text-main"
		>
			{#if models.length === 0}<option value="">Brak dostępnych modeli</option>{/if}
			{#each models as model (model.id)}<option
					value={model.id}
					disabled={model.available === false}
					>{model.name}{model.recommended ? ' — polecany' : ''}</option
				>{/each}
		</select>
	</label>
	<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
		<span
			>Szacunek operacji: <strong class="font-mono text-text-main"
				>{estimatedCostUsd === null ? 'brak cennika' : usd.format(estimatedCostUsd)}</strong
			></span
		>
		{#if usage?.quotationCostUsdMicros !== undefined}<span
				>Ta wycena: <strong class="font-mono text-text-main"
					>{usd.format(usage.quotationCostUsdMicros / 1_000_000)}</strong
				></span
			>{/if}
		{#if usage?.monthCostUsdMicros !== undefined}<span
				>Miesiąc: <strong class="font-mono text-text-main"
					>{usd.format(usage.monthCostUsdMicros / 1_000_000)}</strong
				></span
			>{/if}
	</div>
</div>
