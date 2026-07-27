<script lang="ts">
	import { Collapsible } from 'bits-ui';
	import { CaretDown } from 'phosphor-svelte';
	import type { Snippet } from 'svelte';

	type Props = {
		title: string;
		description?: string;
		open?: boolean;
		children: Snippet;
	};

	let { title, description, open = $bindable(false), children }: Props = $props();
</script>

<Collapsible.Root bind:open class="rounded-md border border-border-line bg-bg-panel">
	<Collapsible.Trigger
		class="flex w-full items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-bg-app/50 sm:p-5"
	>
		<div>
			<h2 class="font-semibold text-text-main">{title}</h2>
			{#if description}
				<p class="mt-1 text-xs text-text-muted">{description}</p>
			{/if}
		</div>
		<CaretDown
			class="h-5 w-5 shrink-0 text-text-muted transition-transform duration-200 {open
				? 'rotate-180'
				: ''}"
		/>
	</Collapsible.Trigger>
	<Collapsible.Content
		hiddenUntilFound
		class="data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up overflow-hidden"
	>
		<div class="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
			{@render children()}
		</div>
	</Collapsible.Content>
</Collapsible.Root>
