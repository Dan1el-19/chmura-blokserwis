<script lang="ts">
	import { CloudArrowUp } from 'phosphor-svelte';
	import type { UppyState } from '$lib/modules/upload.svelte';

	let { uppyState, openFilePicker } = $props<{
		uppyState: UppyState;
		openFilePicker: () => void;
	}>();

	let isDragging = $state(false);

	function onDragOver(e: DragEvent) {
		e.preventDefault();
		isDragging = true;
	}

	function onDragLeave(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;
		if (e.dataTransfer?.files) {
			Array.from(e.dataTransfer.files).forEach((file) => {
				uppyState.addFile(file);
			});
		}
	}
</script>

<div
	role="button"
	tabindex="0"
	ondragover={onDragOver}
	ondragleave={onDragLeave}
	ondrop={onDrop}
	onclick={openFilePicker}
	onkeydown={(e) => e.key === 'Enter' && openFilePicker()}
	class="relative hidden flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors lg:flex
           {isDragging
		? 'border-primary bg-blue-50/50 dark:bg-blue-900/10'
		: 'border-border-line hover:border-gray-400 dark:hover:border-zinc-600'}
           cursor-pointer"
>
	<div class="rounded-full border border-border-line bg-bg-panel p-3">
		<CloudArrowUp class="h-6 w-6 text-primary lg:h-7 lg:w-7" />
	</div>
	<p class="mt-3 text-sm font-medium text-text-main lg:text-base">
		Drop files here or <span class="text-primary hover:underline">browse</span>
	</p>
	<p class="mt-1 text-xs text-text-muted lg:text-sm">Any file type</p>
</div>
