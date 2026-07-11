<script lang="ts">
	import { Lightning, CaretDown, CloudArrowUp, Database } from 'phosphor-svelte';
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
		// Fast Upload defers to admin's recommended_upload_destination — 'auto'
		// tells the upload manager to honour the service-wide setting (r2 /
		// appwrite / hybrid) via the existing mechanism until a dedicated
		// Fast Upload pipeline replaces this call.
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

<div class="relative inline-flex items-center gap-1.5" bind:this={rootEl}>
	<button
		type="button"
		onclick={handlePrimaryClick}
		{disabled}
		class="group inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-primary/90 hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:outline-none active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none disabled:active:scale-100 motion-reduce:transition-none motion-reduce:active:scale-100"
	>
		<Lightning
			class="h-4 w-4 shrink-0 transition-transform duration-150 group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
			weight="fill"
		/>
		<span>Fast Upload</span>
	</button>

	<button
		type="button"
		onclick={toggleDropdown}
		{disabled}
		aria-haspopup="menu"
		aria-expanded={dropdownOpen}
		aria-label="Więcej opcji przesyłania"
		title="Wybierz miejsce przesyłania"
		class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-gray-100 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-zinc-800"
	>
		<CaretDown class="h-4 w-4 transition-transform duration-150 {dropdownOpen ? 'rotate-180' : ''} motion-reduce:transition-none" weight="bold" />
	</button>

	{#if dropdownOpen}
		<div
			class="absolute top-full right-0 z-50 mt-2 min-w-[240px] overflow-hidden rounded-lg border border-border-line bg-bg-panel py-1 shadow-lg"
			role="menu"
		>
			<p class="px-3 pt-1.5 pb-1 text-[11px] font-medium tracking-wide text-text-muted uppercase">
				Wybierz miejsce
			</p>
			<button
				type="button"
				role="menuitem"
				onclick={() => handleOptionClick('r2')}
				class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-main transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
			>
				<CloudArrowUp class="h-4 w-4 text-text-muted" />
				<span>Cloudflare R2</span>
			</button>
			<button
				type="button"
				role="menuitem"
				onclick={() => handleOptionClick('appwrite')}
				class="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-main transition-colors hover:bg-gray-50 focus-visible:bg-gray-50 focus-visible:outline-none dark:hover:bg-zinc-800 dark:focus-visible:bg-zinc-800"
			>
				<Database class="h-4 w-4 text-text-muted" />
				<span>Appwrite Storage</span>
			</button>
		</div>
	{/if}
</div>
