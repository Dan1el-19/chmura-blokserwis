<script lang="ts">
	import { getMediaKind, canPreviewInline } from '$lib/utils/file-preview';

	let {
		fileName,
		mimeType,
		previewUrl,
		downloadUrl
	}: {
		fileName: string;
		mimeType: string;
		previewUrl: string | null;
		downloadUrl: string | null;
	} = $props();

	const kind = $derived(getMediaKind(mimeType));
	const showPreview = $derived(Boolean(previewUrl && downloadUrl && canPreviewInline(mimeType)));
</script>

{#if showPreview && previewUrl}
	<div class="w-full px-8">
		{#if kind === 'image'}
			<img
				src={previewUrl}
				alt={fileName}
				class="mx-auto max-h-[50vh] max-w-full rounded-lg object-contain"
			/>
		{:else if kind === 'audio'}
			<audio src={previewUrl} controls preload="metadata" class="w-full"></audio>
		{:else if kind === 'video'}
			<video
				src={previewUrl}
				controls
				preload="metadata"
				class="max-h-[50vh] w-full rounded-lg bg-black"
			></video>
		{/if}
	</div>
{/if}
