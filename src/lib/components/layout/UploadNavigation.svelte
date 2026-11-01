<script lang="ts">
	import { CloudArrowUp } from 'phosphor-svelte';
	import type { UploadManager } from '#lib/upload-manager.svelte.js';
	let { manager, onopen }: { manager: UploadManager; onopen?: () => void } = $props();
</script>

{#if manager.tasks.length}
	<button
		type="button"
		aria-label="Pokaż transfery"
		onclick={() => {
			manager.collapsed = false;
			onopen?.();
		}}
		class="flex w-full items-center gap-3 rounded-md border border-primary/20 bg-bg-panel px-3 py-3 text-left text-sm text-primary"
	>
		<CloudArrowUp class="h-5 w-5 shrink-0" />
		<span aria-live="polite"
			>{manager.pendingCount
				? `Przesyłanie (${manager.pendingCount})`
				: 'Transfery zakończone'}</span
		>
	</button>
{/if}
