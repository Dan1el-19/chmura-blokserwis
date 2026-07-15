<script lang="ts">
	import { ArrowCounterClockwise, MagicWand, Plus, Trash } from 'phosphor-svelte';
	type Block = {
		id: string;
		label: string;
		title: string;
		content: string;
		relatedItemIds: string[];
		sortOrder: number;
		source: 'manual' | 'ai' | 'product_knowledge';
	};
	type Props = {
		blocks: Block[];
		disabled?: boolean;
		revisingId?: string;
		canUndo?: boolean;
		onchange: (blocks: Block[]) => void;
		onrevise: (blockId: string, feedback: string) => void;
		onundo: () => void;
	};
	let {
		blocks,
		disabled = false,
		revisingId = '',
		canUndo = false,
		onchange,
		onrevise,
		onundo
	}: Props = $props();
	let feedback = $state<Record<string, string>>({});
	function update(index: number, field: keyof Block, value: string) {
		onchange(
			blocks.map((block, i) =>
				i === index ? { ...block, [field]: value, source: 'manual' } : block
			)
		);
	}
	function add() {
		onchange([
			...blocks,
			{
				id: `block-${crypto.randomUUID()}`,
				label: `Sekcja ${blocks.length + 1}`,
				title: 'Nowy opis',
				content: 'Uzupełnij opis.',
				relatedItemIds: [],
				sortOrder: blocks.length,
				source: 'manual'
			}
		]);
	}
	function remove(index: number) {
		onchange(
			blocks.filter((_, i) => i !== index).map((block, sortOrder) => ({ ...block, sortOrder }))
		);
	}
</script>

<section class="space-y-4 rounded-md border border-border-line bg-bg-panel p-4 sm:p-5">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div>
			<h2 class="font-semibold text-text-main">Bloki opisu</h2>
			<p class="mt-1 text-xs text-text-muted">Opis zakresu, standardu i korzyści dla klienta.</p>
		</div>
		{#if canUndo}<button
				type="button"
				onclick={onundo}
				class="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
				><ArrowCounterClockwise class="h-4 w-4" /> Cofnij ostatnią zmianę AI</button
			>{/if}
	</div>
	{#each blocks as block, index (block.id)}
		<article class="space-y-3 rounded-md border border-border-line bg-bg-app p-3">
			<div class="grid gap-2 sm:grid-cols-[10rem_minmax(0,1fr)_2.5rem]">
				<input
					{disabled}
					aria-label="Etykieta bloku"
					value={block.label}
					oninput={(event) => update(index, 'label', event.currentTarget.value)}
					class="h-9 rounded-md border border-border-line bg-bg-panel px-2 text-xs text-text-main"
				/><input
					{disabled}
					aria-label="Tytuł bloku"
					value={block.title}
					oninput={(event) => update(index, 'title', event.currentTarget.value)}
					class="h-9 rounded-md border border-border-line bg-bg-panel px-2 text-sm font-medium text-text-main"
				/><button
					type="button"
					{disabled}
					onclick={() => remove(index)}
					class="flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-red-50 hover:text-red-600"
					aria-label="Usuń blok"><Trash class="h-4 w-4" /></button
				>
			</div>
			<textarea
				{disabled}
				aria-label="Treść bloku {block.title}"
				value={block.content}
				oninput={(event) => update(index, 'content', event.currentTarget.value)}
				rows="4"
				class="w-full resize-y rounded-md border border-border-line bg-bg-panel p-3 text-sm leading-6 text-text-main"
			></textarea>
			<div class="flex flex-col gap-2 sm:flex-row">
				<input
					{disabled}
					value={feedback[block.id] ?? ''}
					oninput={(event) => (feedback[block.id] = event.currentTarget.value)}
					placeholder="Np. krócej, bardziej technicznie…"
					class="h-9 min-w-0 flex-1 rounded-md border border-border-line bg-bg-panel px-3 text-xs text-text-main"
				/>
				<div class="flex flex-wrap gap-1">
					<button
						type="button"
						disabled={disabled || revisingId === block.id}
						onclick={() => onrevise(block.id, feedback[block.id] || 'Napisz krócej i konkretniej.')}
						class="inline-flex h-9 items-center gap-1 rounded-md border border-border-line px-2 text-xs font-medium text-text-main hover:bg-bg-panel disabled:opacity-50"
						><MagicWand class="h-3.5 w-3.5" />
						{revisingId === block.id ? 'Poprawiam…' : 'Popraw z AI'}</button
					><button
						type="button"
						{disabled}
						onclick={() => onrevise(block.id, 'Napisz krócej i konkretniej.')}
						class="h-9 rounded-md px-2 text-xs text-text-muted hover:bg-bg-panel">Krócej</button
					><button
						type="button"
						{disabled}
						onclick={() => onrevise(block.id, 'Napisz bardziej technicznie i precyzyjnie.')}
						class="h-9 rounded-md px-2 text-xs text-text-muted hover:bg-bg-panel"
						>Technicznie</button
					>
				</div>
			</div>
		</article>
	{/each}
	<button
		type="button"
		{disabled}
		onclick={add}
		class="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
		><Plus class="h-4 w-4" /> Dodaj blok</button
	>
</section>
