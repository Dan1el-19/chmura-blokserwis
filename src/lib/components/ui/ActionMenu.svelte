<script lang="ts">
	import { tick } from 'svelte';
	import { DotsThreeVertical } from 'phosphor-svelte';
	import AppDialog from '../AppDialog.svelte';
	let { label, triggerLabel, items }: {
		label: string;
		triggerLabel: string;
		items: { id: string; label: string; disabled?: boolean; destructive?: boolean; run: () => void }[];
	} = $props();
	const titleId = $props.id();
	let open = $state(false);
	$effect(() => {
		if (!open) return;
		function closeOnDesktop() { if (window.innerWidth >= 1024) open = false; }
		window.addEventListener('resize', closeOnDesktop);
		return () => window.removeEventListener('resize', closeOnDesktop);
	});
	async function run(action: () => void) {
		open = false;
		await tick();
		action();
	}
</script>

<button type="button" onpointerdown={(event) => event.stopPropagation()} class="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 dark:hover:bg-zinc-800" onclick={() => open = true} aria-label={triggerLabel} aria-haspopup="dialog" aria-expanded={open}>
	<DotsThreeVertical class="h-5 w-5" weight="bold" />
</button>
{#if open}
	<AppDialog labelledby={titleId} mobile="sheet" onclose={() => open = false}>
		<h2 id={titleId} class="mb-3 break-words text-base font-semibold">{label}</h2>
		<div class="flex flex-col">
			{#each items as item (item.id)}
				<button type="button" disabled={item.disabled} onclick={() => run(item.run)} class="min-h-11 rounded-md px-3 py-2 text-left text-sm hover:bg-gray-100 disabled:opacity-50 dark:hover:bg-zinc-800 {item.destructive ? 'mt-2 border-t border-border-line text-red-600' : 'text-text-main'}">{item.label}</button>
			{/each}
		</div>
	</AppDialog>
{/if}
