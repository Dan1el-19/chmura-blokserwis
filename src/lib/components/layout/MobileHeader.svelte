<script lang="ts">
	import favicon from '$lib/assets/favicon.svg';
	import { List, X } from 'phosphor-svelte';

	let { isDrawerOpen = $bindable() } = $props<{
		isDrawerOpen: boolean;
	}>();

	function toggleDrawer() {
		isDrawerOpen = !isDrawerOpen;
	}
</script>

<header
	class="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-border-line bg-bg-panel px-4 lg:hidden"
>
	<div class="flex min-w-0 items-center gap-3">
		<img src={favicon} alt="" class="h-6 w-6 shrink-0" />
		<span class="truncate font-mono text-sm font-bold text-text-main">Chmura Blokserwis</span>
	</div>
	<button
		onclick={toggleDrawer}
		class="relative flex h-11 w-11 items-center justify-center rounded-full text-text-muted transition-colors hover:bg-gray-100 dark:hover:bg-zinc-800"
		aria-label="Przełącz menu"
		aria-expanded={isDrawerOpen}
	>
		<div class="transition-transform duration-300 {isDrawerOpen ? 'rotate-90' : 'rotate-0'}">
			{#if isDrawerOpen}
				<X class="h-6 w-6" weight="bold" />
			{:else}
				<List class="h-6 w-6" />
			{/if}
		</div>
	</button>
</header>
