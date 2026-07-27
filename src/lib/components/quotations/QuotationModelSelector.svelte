<script lang="ts">
	import { RadioGroup, Switch } from 'bits-ui';
	import { CaretLeft, CaretRight } from 'phosphor-svelte';
	import {
		QUOTATION_MODEL_CATEGORIES,
		QUOTATION_MODEL_CATEGORY_META,
		modelReasoningEffort,
		quotationModelForCategory
	} from '$lib/quotations/models';
	import type { QuotationModelPrice } from '$lib/quotations/types';

	type Usage = {
		quotationCostUsdMicros?: number;
		monthCostUsdMicros?: number;
		operations?: number;
	};
	type Props = {
		models?: QuotationModelPrice[];
		value: string;
		usage?: Usage | null;
		estimatedCostUsd?: number | null;
		reasoningEnabled?: boolean;
		manualSelection?: boolean;
		onchange: (id: string) => void;
		onreasoningchange: (enabled: boolean) => void;
		onresetauto: () => void;
	};
	let {
		models = [],
		value,
		usage = null,
		estimatedCostUsd = 0,
		reasoningEnabled = false,
		manualSelection = false,
		onchange,
		onreasoningchange,
		onresetauto
	}: Props = $props();

	const usd = new Intl.NumberFormat('pl-PL', {
		style: 'currency',
		currency: 'USD',
		minimumFractionDigits: 4
	});
	const usdRate = new Intl.NumberFormat('pl-PL', {
		minimumFractionDigits: 0,
		maximumFractionDigits: 4
	});

	let slots = $derived(
		QUOTATION_MODEL_CATEGORIES.map((category) => ({
			category,
			meta: QUOTATION_MODEL_CATEGORY_META[category],
			model: quotationModelForCategory(models, category)
		})).filter((slot) => slot.model)
	);

	let selectedIndex = $derived(slots.findIndex((slot) => slot.model?.id === value));

	function selectIndex(index: number) {
		const model = slots[index]?.model;
		if (model && model.available !== false) onchange(model.id);
	}

	function prev() {
		if (selectedIndex > 0) selectIndex(selectedIndex - 1);
	}

	function next() {
		if (selectedIndex < slots.length - 1) selectIndex(selectedIndex + 1);
	}

	let selected = $derived(models.find((model) => model.id === value));
	let reasoningEffort = $derived(modelReasoningEffort(selected));
	let reasoningAvailable = $derived(reasoningEffort !== null);

	function pricePerMillion(value: string | undefined) {
		if (value === undefined || value.trim() === '') return 'brak cennika';
		const perToken = Number(value);
		return Number.isFinite(perToken) && perToken >= 0
			? `${usdRate.format(perToken * 1_000_000)} USD`
			: 'brak cennika';
	}
</script>

<div class="space-y-4" role="group" aria-labelledby="quotation-model-label">
	<div class="flex flex-wrap items-start justify-between gap-2">
		<div>
			<p id="quotation-model-label" class="text-sm font-medium text-text-main">Model AI</p>
			<p id="quotation-model-rule" class="mt-0.5 text-xs text-text-muted">
				{manualSelection
					? 'Wybór ręczny obowiązuje przy generowaniu i poprawkach.'
					: 'Automatycznie: Standardowy do generowania, Szybki do poprawek.'}
			</p>
		</div>
		{#if manualSelection}
			<button
				type="button"
				onclick={onresetauto}
				class="text-xs font-medium text-primary hover:underline"
			>
				Wróć do automatycznego doboru
			</button>
		{/if}
	</div>

	<div class="flex items-center gap-2">
		<button
			type="button"
			disabled={selectedIndex <= 0}
			onclick={prev}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-line bg-bg-panel text-text-muted transition-colors hover:bg-bg-app hover:text-text-main disabled:opacity-30"
			aria-label="Poprzedni poziom"
		>
			<CaretLeft class="h-4 w-4" />
		</button>

		<RadioGroup.Root
			{value}
			onValueChange={onchange}
			orientation="horizontal"
			class="min-w-0 flex-1 overflow-hidden"
		>
			<div
				class="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 scrollbar-hide"
				role="listbox"
				aria-label="Poziomy modeli AI"
			>
				{#each slots as slot (slot.category)}
					<RadioGroup.Item
						value={slot.model!.id}
						disabled={slot.model!.available === false}
						class="min-w-[8.5rem] max-w-[10rem] shrink-0 snap-center rounded-lg border p-3 text-left transition-all
							border-border-line bg-bg-app hover:border-primary/50
							data-[state=checked]:border-primary data-[state=checked]:bg-blue-50
							dark:data-[state=checked]:bg-blue-950/20
							data-disabled:cursor-not-allowed data-disabled:opacity-40"
					>
						<span class="block text-xs font-medium text-text-muted">{slot.meta.label}</span>
						<span class="block truncate text-sm font-semibold text-text-main">
							{slot.model!.name}
						</span>
					</RadioGroup.Item>
				{/each}
			</div>
		</RadioGroup.Root>

		<button
			type="button"
			disabled={selectedIndex >= slots.length - 1}
			onclick={next}
			class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border-line bg-bg-panel text-text-muted transition-colors hover:bg-bg-app hover:text-text-main disabled:opacity-30"
			aria-label="Następny poziom"
		>
			<CaretRight class="h-4 w-4" />
		</button>
	</div>

	<div class="rounded-md border border-border-line bg-bg-app p-3">
		<label class="flex items-start gap-3 text-sm text-text-main">
			<Switch.Root
				checked={reasoningEnabled && reasoningAvailable}
				disabled={!reasoningAvailable}
				onCheckedChange={(checked) => onreasoningchange(checked)}
				class="peer mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border border-border-line bg-bg-panel transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-primary data-[state=checked]:bg-primary"
			>
				<Switch.Thumb
					class="pointer-events-none block h-4 w-4 rounded-full bg-text-muted shadow-sm transition-transform data-[state=checked]:translate-x-4 data-[state=checked]:bg-white"
				/>
			</Switch.Root>
			<span>
				<span class="font-medium">Reasoning</span>
				<span class="mt-0.5 block text-xs leading-5 text-text-muted">
					{#if reasoningAvailable}
						Włącza rozumowanie z poziomem {reasoningEffort}. Poprawia jakość, ale zużywa więcej
						tokenów.
					{:else if selected}
						Reasoning nie jest dostępny dla modelu {selected.name}.
					{:else}
						Wybierz dostępny model, aby sprawdzić obsługę reasoning.
					{/if}
				</span>
			</span>
		</label>
	</div>

	<div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-muted">
		<span>
			Szacunek generowania:
			<strong class="font-mono text-text-main">
				{estimatedCostUsd === null ? 'brak cennika' : usd.format(estimatedCostUsd)}
			</strong>
		</span>
		{#if usage?.quotationCostUsdMicros !== undefined}
			<span>
				Ta wycena:
				<strong class="font-mono text-text-main">
					{usd.format(usage.quotationCostUsdMicros / 1_000_000)}
				</strong>
			</span>
		{/if}
		{#if usage?.monthCostUsdMicros !== undefined}
			<span>
				Miesiąc:
				<strong class="font-mono text-text-main">
					{usd.format(usage.monthCostUsdMicros / 1_000_000)}
				</strong>
			</span>
		{/if}
	</div>

	{#if selected}
		<p class="text-[0.7rem] leading-4 text-text-muted">
			Cennik {selected.name} za 1 mln tokenów: wejście
			<strong class="font-mono font-medium text-text-main">
				{pricePerMillion(selected.promptPriceUsd)}
			</strong>, wyjście
			<strong class="font-mono font-medium text-text-main">
				{pricePerMillion(selected.completionPriceUsd)}
			</strong>.
		</p>
	{/if}
</div>
