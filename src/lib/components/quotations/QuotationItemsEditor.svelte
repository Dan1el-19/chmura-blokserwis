<script lang="ts">
	import { Plus, Trash } from 'phosphor-svelte';

	type Category = { id: string; title: string; sortOrder: number };
	type Item = {
		id: string;
		name: string;
		shortDescription?: string;
		quantity: number;
		unit: string;
		unitGrossCents: number;
		totalGrossCents: number;
		categoryId: string;
		sortOrder: number;
	};
	type Props = {
		categories: Category[];
		items: Item[];
		disabled?: boolean;
		onchange: (categories: Category[], items: Item[]) => void;
	};
	let { categories, items, disabled = false, onchange }: Props = $props();
	const money = new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' });

	function uid(prefix: string) {
		return `${prefix}-${crypto.randomUUID()}`;
	}
	function updateCategory(index: number, title: string) {
		const next = categories.map((category, i) => (i === index ? { ...category, title } : category));
		onchange(next, items);
	}
	function addCategory() {
		onchange(
			[
				...categories,
				{
					id: uid('category'),
					title: `Kategoria ${categories.length + 1}`,
					sortOrder: categories.length
				}
			],
			items
		);
	}
	function removeCategory(index: number) {
		if (categories.length === 1) return;
		const removed = categories[index];
		const fallback = categories.find((_, i) => i !== index)!;
		const nextCategories = categories
			.filter((_, i) => i !== index)
			.map((category, sortOrder) => ({ ...category, sortOrder }));
		const nextItems = items.map((item) =>
			item.categoryId === removed.id ? { ...item, categoryId: fallback.id } : item
		);
		onchange(nextCategories, nextItems);
	}
	function addItem(categoryId = categories[0].id) {
		const next: Item = {
			id: uid('item'),
			name: 'Nowa pozycja',
			shortDescription: '',
			quantity: 1,
			unit: 'szt.',
			unitGrossCents: 0,
			totalGrossCents: 0,
			categoryId,
			sortOrder: items.length
		};
		onchange(categories, [...items, next]);
	}
	function updateItem(index: number, field: keyof Item, raw: string) {
		const current = items[index];
		let value: string | number = raw;
		if (field === 'quantity') value = Math.max(0.001, Number(raw) || 0.001);
		if (field === 'unitGrossCents')
			value = Math.max(0, Math.round((Number(raw.replace(',', '.')) || 0) * 100));
		const nextItem = { ...current, [field]: value };
		nextItem.totalGrossCents = Math.round(nextItem.quantity * nextItem.unitGrossCents);
		onchange(
			categories,
			items.map((item, i) => (i === index ? nextItem : item))
		);
	}
	function removeItem(index: number) {
		if (items.length === 1) return;
		onchange(
			categories,
			items.filter((_, i) => i !== index).map((item, sortOrder) => ({ ...item, sortOrder }))
		);
	}
</script>

<section class="space-y-4 rounded-md border border-border-line bg-bg-panel p-4 sm:p-5">
	<div class="flex items-center justify-between gap-3">
		<div>
			<h2 class="font-semibold text-text-main">Kategorie i pozycje</h2>
			<p class="mt-1 text-xs text-text-muted">Kwoty wpisuj brutto.</p>
		</div>
		<button
			type="button"
			{disabled}
			onclick={() => addItem()}
			class="inline-flex items-center gap-2 rounded-md border border-border-line px-3 text-sm font-medium text-text-main hover:bg-bg-app disabled:opacity-50"
			><Plus class="h-4 w-4" /> Pozycja</button
		>
	</div>
	{#each categories as category, categoryIndex (category.id)}
		<div class="space-y-3 rounded-md border border-border-line bg-bg-app p-3">
			<div class="flex gap-2">
				<label class="min-w-0 flex-1"
					><span class="sr-only">Nazwa kategorii</span><input
						{disabled}
						value={category.title}
						oninput={(event) => updateCategory(categoryIndex, event.currentTarget.value)}
						class="h-10 w-full rounded-md border border-border-line bg-bg-panel px-3 text-sm font-semibold text-text-main"
					/></label
				>
				<button
					type="button"
					disabled={disabled || categories.length === 1}
					onclick={() => removeCategory(categoryIndex)}
					class="flex h-10 w-10 items-center justify-center rounded-md text-text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
					aria-label="Usuń kategorię"><Trash class="h-4 w-4" /></button
				>
			</div>
			{#each items as item, itemIndex (item.id)}
				{#if item.categoryId === category.id}
					<div
						class="grid gap-2 rounded-md border border-border-line bg-bg-panel p-3 lg:grid-cols-[minmax(12rem,1fr)_6rem_6rem_8rem_2.5rem]"
					>
						<div class="grid gap-2">
							<input
								{disabled}
								aria-label="Nazwa pozycji"
								value={item.name}
								oninput={(event) => updateItem(itemIndex, 'name', event.currentTarget.value)}
								class="h-9 rounded-md border border-border-line bg-bg-app px-2 text-sm font-medium text-text-main"
							/><input
								{disabled}
								aria-label="Krótki opis"
								value={item.shortDescription ?? ''}
								oninput={(event) =>
									updateItem(itemIndex, 'shortDescription', event.currentTarget.value)}
								placeholder="Krótki opis (opcjonalnie)"
								class="h-9 rounded-md border border-border-line bg-bg-app px-2 text-xs text-text-main"
							/>
						</div>
						<label class="grid gap-1 text-xs text-text-muted"
							>Ilość<input
								{disabled}
								type="number"
								min="0.001"
								step="0.001"
								value={item.quantity}
								oninput={(event) => updateItem(itemIndex, 'quantity', event.currentTarget.value)}
								class="h-9 rounded-md border border-border-line bg-bg-app px-2 font-mono text-text-main"
							/></label
						>
						<label class="grid gap-1 text-xs text-text-muted"
							>Jednostka<input
								{disabled}
								value={item.unit}
								oninput={(event) => updateItem(itemIndex, 'unit', event.currentTarget.value)}
								class="h-9 rounded-md border border-border-line bg-bg-app px-2 text-text-main"
							/></label
						>
						<label class="grid gap-1 text-xs text-text-muted"
							>Cena brutto<input
								{disabled}
								inputmode="decimal"
								value={(item.unitGrossCents / 100).toFixed(2)}
								oninput={(event) =>
									updateItem(itemIndex, 'unitGrossCents', event.currentTarget.value)}
								class="h-9 rounded-md border border-border-line bg-bg-app px-2 text-right font-mono text-text-main"
							/><span class="text-right">{money.format(item.totalGrossCents / 100)}</span></label
						>
						<button
							type="button"
							disabled={disabled || items.length === 1}
							onclick={() => removeItem(itemIndex)}
							class="mt-5 flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
							aria-label="Usuń pozycję {item.name}"><Trash class="h-4 w-4" /></button
						>
					</div>
				{/if}
			{/each}
			<button
				type="button"
				{disabled}
				onclick={() => addItem(category.id)}
				class="text-xs font-medium text-primary hover:underline disabled:opacity-50"
				>+ Dodaj pozycję w tej kategorii</button
			>
		</div>
	{/each}
	<button
		type="button"
		{disabled}
		onclick={addCategory}
		class="text-sm font-medium text-primary hover:underline disabled:opacity-50"
		>+ Dodaj kategorię</button
	>
</section>
