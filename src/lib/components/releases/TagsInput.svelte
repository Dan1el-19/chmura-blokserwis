<script lang="ts">
	import { X } from 'phosphor-svelte';

	type Props = {
		value?: string[];
		suggestions?: string[];
		label?: string;
		placeholder?: string;
	};

	let {
		value = $bindable([]),
		suggestions = ['latest', 'stable', 'beta', 'alpha'],
		label,
		placeholder = 'Add tag...'
	}: Props = $props();

	let inputValue = $state('');
	let showSuggestions = $state(false);

	const filteredSuggestions = $derived(
		suggestions.filter((s) => !value.includes(s) && s.toLowerCase().includes(inputValue.toLowerCase()))
	);

	function addTag(tag: string) {
		const trimmed = tag.trim().toLowerCase();
		if (trimmed && !value.includes(trimmed)) {
			value = [...value, trimmed];
		}
		inputValue = '';
		showSuggestions = false;
	}

	function removeTag(tag: string) {
		value = value.filter((t) => t !== tag);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && inputValue.trim()) {
			e.preventDefault();
			addTag(inputValue);
		}
		if (e.key === 'Backspace' && !inputValue && value.length > 0) {
			value = value.slice(0, -1);
		}
	}
</script>

<div class="space-y-1.5">
	{#if label}
		<span class="block text-sm font-medium text-text-muted">{label}</span>
	{/if}

	<div
		class="flex flex-wrap items-center gap-2 rounded-md border border-border-line bg-transparent px-3 py-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary"
	>
		{#each value as tag}
			<span
				class="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
			>
				{tag}
				<button
					type="button"
					onclick={() => removeTag(tag)}
					class="hover:text-primary/70 focus:outline-none"
				>
					<X class="h-3 w-3" />
				</button>
			</span>
		{/each}

		<div class="relative flex-1">
			<input
				type="text"
				bind:value={inputValue}
				onkeydown={handleKeydown}
				onfocus={() => (showSuggestions = true)}
				onblur={() => setTimeout(() => (showSuggestions = false), 200)}
				{placeholder}
				class="w-full min-w-[100px] border-0 bg-transparent p-0 text-sm text-text-main placeholder:text-text-muted focus:outline-none focus:ring-0"
			/>

			{#if showSuggestions && filteredSuggestions.length > 0}
				<div
					class="absolute left-0 top-full z-10 mt-1 w-48 rounded-md border border-border-line bg-bg-panel py-1 shadow-lg"
				>
					{#each filteredSuggestions as suggestion}
						<button
							type="button"
							onclick={() => addTag(suggestion)}
							class="block w-full px-3 py-1.5 text-left text-sm text-text-main hover:bg-gray-100 dark:hover:bg-zinc-800"
						>
							{suggestion}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	</div>
</div>
