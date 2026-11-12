<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	let {
		labelledby,
		describedby,
		busy = false,
		alert = false,
		wide = false,
		mobile = 'dialog',
		onclose,
		children
	}: {
		labelledby: string;
		describedby?: string;
		busy?: boolean;
		alert?: boolean;
		wide?: boolean;
		mobile?: 'dialog' | 'sheet';
		onclose: () => void;
		children: Snippet;
	} = $props();
	let dialog: HTMLDialogElement;
	onMount(() => {
		const previous = document.activeElement;
		dialog.showModal();
		return () => {
			dialog.close();
			if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
		};
	});
</script>

<dialog
	bind:this={dialog}
	role={alert ? 'alertdialog' : 'dialog'}
	aria-labelledby={labelledby}
	aria-describedby={describedby}
	aria-modal="true"
	aria-busy={busy}
	oncancel={(event) => {
		event.preventDefault();
		if (!busy) onclose();
	}}
	class="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] overflow-y-auto rounded-md border border-border-line bg-bg-panel p-5 text-text-main shadow-lg backdrop:bg-black/40 backdrop:backdrop-blur-sm {wide ? 'max-w-5xl' : 'max-w-sm'} {mobile === 'sheet' ? 'max-sm:mt-auto max-sm:mb-0 max-sm:w-full max-sm:max-w-none max-sm:rounded-b-none max-sm:pb-[max(1.25rem,env(safe-area-inset-bottom))]' : ''}"
>
	{@render children()}
</dialog>
