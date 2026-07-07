<script lang="ts">
	import { canPreviewInline, getMediaKind, getThumbnailLabel } from '$lib/utils/file-preview';

	let {
		fileName,
		mimeType,
		previewUrl,
		downloadUrl,
		fileSize = 0
	}: {
		fileName: string;
		mimeType: string;
		previewUrl: string | null;
		downloadUrl: string | null;
		fileSize?: number | null;
	} = $props();

	const resolvedPreviewUrl = $derived(previewUrl ?? downloadUrl);
	const showPreview = $derived(Boolean(resolvedPreviewUrl && canPreviewInline(mimeType)));
	const kind = $derived(getMediaKind(mimeType));
	const label = $derived(getThumbnailLabel({ name: fileName, mimeType }));
</script>

{#if showPreview && resolvedPreviewUrl}
	<section
		class="flex min-h-[220px] w-full flex-col overflow-hidden rounded-md border border-border-line bg-bg-panel"
		aria-label="Podgląd pliku {fileName}"
	>
		<div class="border-b border-border-line px-4 py-3 text-left">
			<p class="text-xs font-semibold tracking-wide text-text-muted uppercase">{label}</p>
			<h2 class="mt-1 truncate text-sm font-semibold text-text-main">{fileName}</h2>
		</div>

		<div
			class="flex flex-1 items-center justify-center overflow-auto bg-gray-50 p-4 dark:bg-zinc-950/60"
		>
			{#if kind === 'image'}
				<img
					src={resolvedPreviewUrl}
					alt={fileName}
					class="max-h-[60vh] max-w-full rounded-sm object-contain"
				/>
			{:else if kind === 'audio'}
				<audio src={resolvedPreviewUrl} controls preload="metadata" class="w-full"></audio>
			{:else if kind === 'video'}
				<!-- svelte-ignore a11y_media_has_caption (user-uploaded videos do not provide caption tracks) -->
				<video
					src={resolvedPreviewUrl}
					controls
					preload="metadata"
					class="max-h-[60vh] w-full bg-black"
				></video>
			{/if}
		</div>
	</section>
{/if}
