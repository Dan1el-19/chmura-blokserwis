<script lang="ts">
	import { FolderPlus, Plus, UploadSimple } from 'phosphor-svelte';
	import { fly, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';

	let { onUpload, onNewFolder } = $props<{
		onUpload: () => void;
		onNewFolder?: () => void;
	}>();

	let isMenuOpen = $state(false);

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}
</script>

<div class="fixed right-6 bottom-0 z-40 flex flex-col items-end gap-3 lg:hidden">
	{#if isMenuOpen}
		<button
			class="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
			onclick={() => (isMenuOpen = false)}
			aria-label="Zamknij menu"
			transition:scale={{ duration: 200, start: 0.95 }}
		></button>

		<div class="relative z-40 flex flex-col items-end gap-2" role="menu" aria-label="Akcje">
			<button
				type="button"
				role="menuitem"
				class="flex items-center gap-3 rounded-full bg-bg-panel py-2.5 pr-4 pl-3 shadow-lg transition-transform focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none active:scale-95"
				onclick={() => {
					isMenuOpen = false;
					onNewFolder?.();
				}}
				in:fly={{ y: 20, x: 10, duration: 250, delay: 50, easing: backOut }}
				out:scale={{ duration: 150, start: 0.9 }}
			>
				<div
					class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white"
				>
					<FolderPlus class="h-5 w-5" weight="bold" />
				</div>
				<span class="text-sm font-medium text-text-main">Nowy folder</span>
			</button>

			<button
				type="button"
				role="menuitem"
				class="flex items-center gap-3 rounded-full bg-bg-panel py-2.5 pr-4 pl-3 shadow-lg transition-transform focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none active:scale-95"
				onclick={() => {
					isMenuOpen = false;
					onUpload();
				}}
				in:fly={{ y: 20, x: 10, duration: 250, easing: backOut }}
				out:scale={{ duration: 150, start: 0.9 }}
			>
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
					<UploadSimple class="h-5 w-5" weight="bold" />
				</div>
				<span class="text-sm font-medium text-text-main">Prześlij pliki</span>
			</button>
		</div>
	{/if}

	<button
		type="button"
		class="relative z-50 flex h-14 w-14 items-center justify-center rounded-xl shadow-lg transition-all duration-300 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none active:scale-95
		       {isMenuOpen ? 'bg-zinc-700 shadow-xl dark:bg-zinc-600' : 'bg-primary'}"
		onclick={toggleMenu}
		aria-label={isMenuOpen ? 'Zamknij menu' : 'Otwórz menu'}
		aria-haspopup="menu"
		aria-expanded={isMenuOpen}
	>
		<div
			class="transform-gpu transition-transform duration-300 {isMenuOpen
				? 'rotate-45'
				: 'rotate-0'}"
		>
			<Plus class="h-6 w-6 text-white" weight="bold" />
		</div>
	</button>
</div>
