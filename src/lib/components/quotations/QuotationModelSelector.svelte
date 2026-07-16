<script lang="ts">
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
	let selected = $derived(models.find((model) => model.id === value));
	let reasoningEffort = $derived(modelReasoningEffort(selected));
	let reasoningAvailable = $derived(reasoningEffort !== null);
	let modelSlots = $derived(
		QUOTATION_MODEL_CATEGORIES.map((category) => ({
			category,
			meta: QUOTATION_MODEL_CATEGORY_META[category],
			model: quotationModelForCategory(models, category)
		}))
	);
	let selectedSlot = $derived(modelSlots.find((slot) => slot.model?.id === value));
	let selectedSlotIndex = $derived(modelSlots.findIndex((slot) => slot.model?.id === value));
	const progressClasses = ['w-0', 'w-[20%]', 'w-[40%]', 'w-[60%]', 'w-[80%]'];

	function pricePerMillion(value: string | undefined) {
		if (value === undefined || value.trim() === '') return 'brak cennika';
		const perToken = Number(value);
		return Number.isFinite(perToken) && perToken >= 0
			? `${usdRate.format(perToken * 1_000_000)} USD`
			: 'brak cennika';
	}
</script>

<div class="grid gap-3">
	<div class="flex flex-wrap items-end justify-between gap-2">
		<div>
			<p id="quotation-model-label" class="text-sm font-medium text-text-main">Model AI</p>
			<p id="quotation-model-rule" class="mt-0.5 text-xs text-text-muted">
				{manualSelection
					? 'Wybór ręczny obowiązuje przy generowaniu i wszystkich poprawkach.'
					: 'Automatycznie: Standardowy do generowania, Szybki do poprawek i review.'}
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

	<div
		role="radiogroup"
		aria-labelledby="quotation-model-label"
		aria-describedby="quotation-model-rule"
		class="rounded-lg border border-border-line bg-bg-app px-1 py-2.5"
		data-model-track
	>
		<div class="relative grid h-9 grid-cols-5 items-center px-2">
			<div
				class="absolute top-1/2 right-[10%] left-[10%] h-1 -translate-y-1/2 rounded-full bg-border-line"
				aria-hidden="true"
			></div>
			<div
				class="absolute top-1/2 left-[10%] h-1 -translate-y-1/2 rounded-full bg-primary transition-[width] duration-200 motion-reduce:transition-none {progressClasses[
					selectedSlotIndex
				] ?? 'w-0'}"
				aria-hidden="true"
			></div>
			{#each modelSlots as slot (slot.category)}
				{#if slot.model}
					<label
						class="relative z-10 flex h-9 cursor-pointer items-center justify-center rounded-full focus-within:ring-2 focus-within:ring-primary/40 focus-within:ring-offset-2 focus-within:ring-offset-bg-app {slot
							.model.available === false
							? 'cursor-not-allowed opacity-40'
							: ''}"
						title="{slot.meta.label} — {slot.model.name}"
					>
						<input
							type="radio"
							name="quotation-ai-model"
							value={slot.model.id}
							checked={value === slot.model.id}
							disabled={slot.model.available === false}
							onchange={() => onchange(slot.model!.id)}
							aria-label="{slot.meta.label}: {slot.model.name}"
							class="sr-only"
						/>
						<span
							class={value === slot.model.id
								? 'h-7 w-7 rounded-full border-[5px] border-primary bg-bg-panel shadow-sm transition-[width,height] duration-200 motion-reduce:transition-none'
								: 'h-2.5 w-2.5 rounded-full border-2 border-bg-app bg-text-muted transition-[width,height,background-color] duration-200 hover:bg-primary motion-reduce:transition-none'}
							aria-hidden="true"
						></span>
					</label>
				{:else}
					<div
						class="relative z-10 flex h-9 items-center justify-center opacity-35"
						aria-label="{slot.meta.label}: model niedostępny"
					>
						<span class="h-2.5 w-2.5 rounded-full border-2 border-bg-app bg-text-muted"></span>
					</div>
				{/if}
			{/each}
		</div>
	</div>
	{#if selectedSlot?.model}
		<div
			class="flex min-w-0 items-baseline justify-center gap-1.5 px-2 text-center"
			aria-live="polite"
		>
			<span class="text-sm font-semibold text-text-main">{selectedSlot.meta.label}</span>
			<span class="truncate text-xs text-text-muted">{selectedSlot.model.name}</span>
		</div>
	{/if}

	<div class="rounded-md border border-border-line bg-bg-app p-3">
		<label class="flex items-start gap-2 text-sm text-text-main">
			<input
				type="checkbox"
				checked={reasoningEnabled && reasoningAvailable}
				disabled={!reasoningAvailable}
				onchange={(event) => onreasoningchange(event.currentTarget.checked)}
				class="mt-0.5 file-selection-checkbox"
			/>
			<span>
				<span class="font-medium">Reasoning</span>
				<span class="mt-0.5 block text-xs leading-5 text-text-muted">
					{#if reasoningAvailable}
						Włącza rozumowanie z poziomem {reasoningEffort}. Może poprawić jakość, ale zużywa więcej
						tokenów i kosztuje więcej.
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
			Szacunek pełnego generowania: <strong class="font-mono text-text-main">
				{estimatedCostUsd === null ? 'brak cennika' : usd.format(estimatedCostUsd)}
			</strong>
		</span>
		{#if usage?.quotationCostUsdMicros !== undefined}
			<span>
				Ta wycena: <strong class="font-mono text-text-main">
					{usd.format(usage.quotationCostUsdMicros / 1_000_000)}
				</strong>
			</span>
		{/if}
		{#if usage?.monthCostUsdMicros !== undefined}
			<span>
				Miesiąc: <strong class="font-mono text-text-main">
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
	<p class="text-[0.7rem] leading-4 text-text-muted">
		Szacunek jest orientacyjny: zakłada 3000 tokenów wejściowych i
		{reasoningEnabled && reasoningAvailable
			? ' 3000 tokenów wyjściowych z reasoning.'
			: ' 1500 tokenów wyjściowych.'}
		Rzeczywisty koszt pochodzi z użycia zarejestrowanego przez dostawcę.
	</p>
</div>
