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
	class="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border-line bg-bg-panel px-4 lg:hidden"
>
	<img src={favicon} alt="" class="h-6 w-6" />
	<span class="absolute left-1/2 -translate-x-1/2 font-mono text-sm font-bold text-text-main"
		>Effinity Cloud</span
	>
	<button
		onclick={toggleDrawer}
		class="relative flex h-10 w-10 items-center justify-center rounded-full text-text-muted transition-all duration-300
						   {isDrawerOpen}"
		aria-label="Toggle menu"
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
