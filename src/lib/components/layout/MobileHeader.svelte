<script lang="ts">
	import blokserwisLogo from '$lib/assets/BlokserwisLogo.svg';
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
	<img src={blokserwisLogo} alt="Blokserwis" class="h-auto w-32 max-w-[calc(100%-5rem)]" />
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
