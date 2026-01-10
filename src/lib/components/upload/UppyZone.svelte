<script lang="ts">
	import type { UppyState } from '$lib/modules/upload.svelte';
	import {
		CloudArrowUp,
		X,
		File as FileIcon,
		Plus,
		FolderPlus,
		UploadSimple
	} from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import { scale, fly } from 'svelte/transition';
	import { quintOut, backOut } from 'svelte/easing';

	let { uppyState, onNewFolder }: { uppyState: UppyState; onNewFolder?: () => void } = $props();

	let isDragging = $state(false);
	let isMenuOpen = $state(false);

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

	function onFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			Array.from(input.files).forEach((file) => {
				uppyState.addFile(file);
			});
			input.value = '';
		}
		isMenuOpen = false;
	}

	function openFilePicker() {
		document.getElementById('file-input')?.click();
	}

	function handleNewFolder() {
		isMenuOpen = false;
		onNewFolder?.();
	}

	function toggleMenu() {
		isMenuOpen = !isMenuOpen;
	}
</script>

<input type="file" multiple class="hidden" id="file-input" onchange={onFileSelect} />

<div class="space-y-4">
	<!-- Drop Zone - Desktop only -->
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

	<!-- File List & Progress -->
	{#if uppyState.files.length > 0}
		<div class="space-y-2" in:fly={{ y: 20, duration: 300, easing: quintOut }}>
			<div class="flex items-center justify-between">
				<h3 class="text-xs font-medium tracking-wider text-text-muted uppercase">Uploads</h3>
				<span class="font-mono text-xs text-text-muted">{uppyState.files.length} Item(s)</span>
			</div>
			{#each uppyState.files as file (file.id)}
				<div
					class="group relative flex items-center gap-3 rounded-md border border-border-line bg-bg-panel p-3"
					in:fly={{ y: 10, duration: 200, easing: quintOut }}
					out:scale={{ duration: 150, start: 0.95 }}
				>
					<div class="shrink-0 text-text-muted">
						<FileIcon class="h-5 w-5" />
					</div>

					<div class="min-w-0 flex-1">
						<div class="mb-1 flex items-center justify-between">
							<p class="truncate text-sm font-medium text-text-main">{file.name}</p>
							<span class="font-mono text-xs text-text-muted">{formatFileSize(file.size)}</span>
						</div>

						<div class="h-1.5 w-full overflow-hidden rounded-full bg-gray-100 dark:bg-zinc-800">
							<div
								class="h-full bg-primary transition-all duration-300"
								style="width: {file.progress?.percentage ?? 0}%"
							></div>
						</div>

						<div class="mt-1 flex justify-between">
							<span class="text-[10px] text-text-muted uppercase">
								{#if file.error}
									<span class="text-red-500">Error</span>
								{:else if file.progress?.uploadComplete}
									<span class="text-green-600">Complete</span>
								{:else}
									{Math.round(file.progress?.percentage ?? 0)}%
								{/if}
							</span>
						</div>
					</div>

					<button
						class="rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
						onclick={(e) => {
							e.stopPropagation();
							uppyState.uppy.removeFile(file.id);
						}}
					>
						<X class="h-4 w-4" />
					</button>
				</div>
			{/each}
		</div>
	{/if}
</div>

<!-- FAB Menu - Mobile only -->
<div class="fixed right-6 bottom-0 z-40 flex flex-col items-end gap-3 lg:hidden">
	<!-- Menu Options -->
	{#if isMenuOpen}
		<!-- Backdrop -->
		<button
			class="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
			onclick={() => (isMenuOpen = false)}
			aria-label="Close menu"
			transition:scale={{ duration: 200, start: 0.95 }}
		></button>

		<!-- Menu Items -->
		<div class="relative z-40 flex flex-col items-end gap-2">
			<!-- New Folder -->
			<button
				class="flex items-center gap-3 rounded-full bg-bg-panel py-2.5 pr-4 pl-3 shadow-lg transition-transform active:scale-95"
				onclick={handleNewFolder}
				in:fly={{ y: 20, x: 10, duration: 250, delay: 50, easing: backOut }}
				out:scale={{ duration: 150, start: 0.9 }}
			>
				<div
					class="flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white"
				>
					<FolderPlus class="h-5 w-5" weight="bold" />
				</div>
				<span class="text-sm font-medium text-text-main">New Folder</span>
			</button>

			<!-- Upload File -->
			<button
				class="flex items-center gap-3 rounded-full bg-bg-panel py-2.5 pr-4 pl-3 shadow-lg transition-transform active:scale-95"
				onclick={openFilePicker}
				in:fly={{ y: 20, x: 10, duration: 250, easing: backOut }}
				out:scale={{ duration: 150, start: 0.9 }}
			>
				<div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-white">
					<UploadSimple class="h-5 w-5" weight="bold" />
				</div>
				<span class="text-sm font-medium text-text-main">Upload File</span>
			</button>
		</div>
	{/if}

	<!-- Main FAB Button -->
	<button
		class="relative z-50 flex h-14 w-14 items-center justify-center rounded-xl shadow-lg transition-all duration-300 active:scale-95
			   {isMenuOpen ? 'bg-zinc-700 dark:bg-zinc-600' : 'bg-primary'}"
		onclick={toggleMenu}
		aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
	>
		<div class="transition-transform duration-300 {isMenuOpen ? 'rotate-45' : 'rotate-0'}">
			<Plus class="h-6 w-6 text-white" weight="bold" />
		</div>
	</button>
</div>
