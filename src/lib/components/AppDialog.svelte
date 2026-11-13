<script lang="ts">
	import type { Snippet } from 'svelte';
	let {
		labelledby,
		describedby,
		busy = false,
		alert = false,
		wide = false,
		size,
		mobile = 'dialog',
		header,
		footer,
		onclose,
		children
	}: {
		labelledby: string;
		describedby?: string;
		busy?: boolean;
		alert?: boolean;
		wide?: boolean;
		size?: 'sm' | 'md' | 'lg';
		mobile?: 'dialog' | 'sheet' | 'fullscreen';
		header?: Snippet;
		footer?: Snippet;
		onclose: () => void;
		children: Snippet;
	} = $props();
	const widthClass = $derived(size === 'sm' ? 'max-w-[440px]' : size === 'md' ? 'max-w-[640px]' : size === 'lg' ? 'max-w-[880px]' : wide ? 'max-w-5xl' : 'max-w-sm');
	function mountDialog(dialog: HTMLDialogElement) {
		const previous = document.activeElement;
		let resizeFrame = 0;
		const keepFocusVisible = () => {
			cancelAnimationFrame(resizeFrame);
			resizeFrame = requestAnimationFrame(() => {
				const active = document.activeElement;
				if (active instanceof HTMLElement && dialog.contains(active)) active.scrollIntoView({ block: 'nearest' });
			});
		};
		window.visualViewport?.addEventListener('resize', keepFocusVisible);
		dialog.showModal();
		return () => {
			window.visualViewport?.removeEventListener('resize', keepFocusVisible);
			cancelAnimationFrame(resizeFrame);
			dialog.close();
			if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
		};
	}
</script>

<dialog
	{@attach mountDialog}
	role={alert ? 'alertdialog' : 'dialog'}
	aria-labelledby={labelledby}
	aria-describedby={describedby}
	aria-modal="true"
	aria-busy={busy}
	oncancel={(event) => {
		event.preventDefault();
		if (!busy) onclose();
	}}
	class="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] rounded-xl border border-border-line bg-bg-panel text-text-main shadow-lg backdrop:bg-black/40 backdrop:backdrop-blur-sm {widthClass} {header || footer ? 'overflow-hidden' : 'overflow-y-auto p-5'} {mobile === 'sheet' ? 'max-sm:mt-auto max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none' : ''} {mobile === 'sheet' && !header && !footer ? 'max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]' : ''} {mobile === 'fullscreen' ? 'max-sm:m-0 max-sm:h-dvh max-sm:max-h-none max-sm:w-full max-sm:max-w-none max-sm:rounded-none' : ''}"
>
	{#if header || footer}
		<div class="flex max-h-[90dvh] flex-col {mobile === 'fullscreen' ? 'max-sm:h-full max-sm:max-h-none' : ''}">
			{#if header}<header class="max-h-[30dvh] shrink-0 overflow-y-auto border-b border-border-line px-5 py-4">{@render header()}</header>{/if}
			<div class="min-h-0 flex-1 overflow-y-auto px-5 py-4 {mobile === 'sheet' && !footer ? 'pb-[max(1rem,env(safe-area-inset-bottom))]' : ''}">{@render children()}</div>
			{#if footer}<footer class="shrink-0 border-t border-border-line px-5 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{@render footer()}</footer>{/if}
		</div>
	{:else}
		{@render children()}
	{/if}
</dialog>
