<script lang="ts">
	import { CloudArrowUp, CaretDown, ArrowsLeftRight, Database } from 'phosphor-svelte';
	import { onMount } from 'svelte';

	type Destination = 'r2' | 'appwrite' | 'auto';

	interface Props {
		onUpload: (destination: Destination) => void;
		disabled?: boolean;
	}

	let { onUpload, disabled = false }: Props = $props();

	let dropdownOpen = $state(false);
	let rootEl: HTMLDivElement | null = $state(null);

	function handlePrimaryClick() {
		if (disabled) return;
		// Primary action defers to admin's recommended_upload_destination.
		// 'auto' tells the upload manager to honour the service-wide setting
		// (r2 / appwrite / hybrid) instead of hard-picking a backend client side.
		onUpload('auto');
	}

	function handleOptionClick(dest: Destination) {
		dropdownOpen = false;
		if (disabled) return;
		onUpload(dest);
	}

	function toggleDropdown(event: MouseEvent) {
		event.stopPropagation();
		if (disabled) return;
		dropdownOpen = !dropdownOpen;
	}

	onMount(() => {
		const onDocClick = (e: MouseEvent) => {
			if (!rootEl?.contains(e.target as Node)) dropdownOpen = false;
		};
		const onKeydown = (e: KeyboardEvent) => {
			if (e.key === 'Escape') dropdownOpen = false;
		};
		document.addEventListener('click', onDocClick);
		document.addEventListener('keydown', onKeydown);
		return () => {
			document.removeEventListener('click', onDocClick);
			document.removeEventListener('keydown', onKeydown);
		};
	});
</script>

<div class="relative inline-flex" bind:this={rootEl}>
	<div
		class="flex overflow-hidden rounded-md border border-primary shadow-sm"
		class:opacity-50={disabled}
	>
		<button
			type="button"
			onclick={handlePrimaryClick}
			{disabled}
			class="flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90 focus:outline-none disabled:cursor-not-allowed"
		>
			<CloudArrowUp class="h-4 w-4" weight="bold" />
			<span>Prześlij</span>
		</button>

		<button
			type="button"
			onclick={toggleDropdown}
			{disabled}
			aria-haspopup="menu"
			aria-expanded={dropdownOpen}
			aria-label="Wybierz miejsce uploadu"
			class="flex items-center justify-center border-l border-white/20 bg-primary px-2 text-white transition-colors hover:bg-primary/90 focus:outline-none disabled:cursor-not-allowed"
		>
			<CaretDown class="h-4 w-4" weight="bold" />
		</button>
	</div>

	{#if dropdownOpen}
		<div
			class="absolute top-full right-0 z-50 mt-1 min-w-[260px] rounded-md border border-border-line bg-bg-panel shadow-lg"
			role="menu"
		>
			<button
				type="button"
				role="menuitem"
				onclick={() => handleOptionClick('r2')}
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-main transition-colors hover:bg-gray-50 dark:hover:bg-zinc-800"
			>
				<CloudArrowUp class="h-4 w-4 text-text-muted" />
				<span>Cloudflare R2</span>
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={() => handleOptionClick('appwrite')}
				class="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-text-main transition-colors last:rounded-b-md hover:bg-gray-50 dark:hover:bg-zinc-800"
			>
				<Database class="h-4 w-4 text-text-muted" />
				<span>Appwrite Storage</span>
			</button>
		</div>
	{/if}
</div>
