<script lang="ts">
	import { File as FileIcon, X } from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import { scale, fly } from 'svelte/transition';
	import { quintOut } from 'svelte/easing';
	import type { UppyState } from '$lib/modules/upload.svelte';

	let { uppyState } = $props<{ uppyState: UppyState }>();
</script>

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
