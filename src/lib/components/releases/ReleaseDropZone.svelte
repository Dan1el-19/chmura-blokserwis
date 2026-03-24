<script lang="ts">
	import { CloudArrowUp, AndroidLogo, Plus } from 'phosphor-svelte';
	import Button from '$lib/components/ui/Button.svelte';

	type Props = {
		onFileSelect: (file: File) => void;
		disabled?: boolean;
	};

	let { onFileSelect, disabled = false }: Props = $props();

	let isDragging = $state(false);
	let fileInput: HTMLInputElement;

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragging = false;

		if (disabled) return;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			const file = files[0];
			if (file.name.endsWith('.apk')) {
				onFileSelect(file);
			}
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		if (!disabled) isDragging = true;
	}

	function handleDragLeave() {
		isDragging = false;
	}

	function handleFileInput(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			onFileSelect(input.files[0]);
			input.value = '';
		}
	}

	export function openPicker() {
		fileInput?.click();
	}
</script>

<input bind:this={fileInput} type="file" accept=".apk" class="hidden" onchange={handleFileInput} />

<!-- Desktop only dropzone -->
<div
	role="button"
	tabindex="0"
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	onclick={openPicker}
	onkeydown={(e) => e.key === 'Enter' && openPicker()}
	class="hidden cursor-pointer rounded-lg border-2 border-dashed p-8 text-center transition-colors lg:block {isDragging
		? 'border-primary bg-primary/5'
		: 'border-border-line hover:border-primary/50'} {disabled ? 'cursor-not-allowed opacity-50' : ''}"
>
	<div class="flex flex-col items-center gap-3">
		{#if isDragging}
			<AndroidLogo class="h-12 w-12 text-primary" weight="fill" />
			<p class="text-lg font-medium text-primary">Upuść plik APK tutaj</p>
		{:else}
			<div class="rounded-full border border-border-line bg-bg-panel p-3">
				<CloudArrowUp class="h-6 w-6 text-primary lg:h-7 lg:w-7" />
			</div>
			<div>
				<p class="font-medium text-text-main">Przeciągnij plik APK lub <span class="text-primary hover:underline">wybierz</span></p>
				<p class="mt-1 text-sm text-text-muted">Akceptowane tylko pliki .apk</p>
			</div>
		{/if}
	</div>
</div>

<!-- Mobile FAB -->
<div class="fixed right-6 bottom-6 z-40 lg:hidden">
	<button
		class="flex h-14 w-14 items-center justify-center rounded-xl bg-primary shadow-lg transition-transform active:scale-95 {disabled ? 'cursor-not-allowed opacity-50' : ''}"
		onclick={openPicker}
		aria-label="Upload APK"
		{disabled}
	>
		<Plus class="h-6 w-6 text-white" weight="bold" />
	</button>
</div>
