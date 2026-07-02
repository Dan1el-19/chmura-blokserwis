<script lang="ts">
	import { File as FileIcon, Image, MusicNotes, VideoCamera } from 'phosphor-svelte';
	import { getMediaKind, getThumbnailLabel } from '$lib/utils/file-preview';

	let {
		name,
		mimeType,
		thumbnailUrl = null
	}: { name: string; mimeType?: string | null; thumbnailUrl?: string | null } = $props();

	const kind = $derived(getMediaKind(mimeType));
	const label = $derived(getThumbnailLabel({ name, mimeType, thumbnailUrl }));
</script>

<div
	class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-line bg-gray-50 text-text-muted dark:bg-zinc-900"
	aria-label={label}
	title={label}
>
	{#if thumbnailUrl && kind === 'image'}
		<img src={thumbnailUrl} alt="" class="h-full w-full object-cover" loading="lazy" />
	{:else if kind === 'image'}
		<Image class="h-5 w-5 text-blue-500" />
	{:else if kind === 'audio'}
		<MusicNotes class="h-5 w-5 text-emerald-600" />
	{:else if kind === 'video'}
		<VideoCamera class="h-5 w-5 text-violet-600" />
	{:else}
		<FileIcon class="h-5 w-5 text-blue-500" />
	{/if}
</div>
