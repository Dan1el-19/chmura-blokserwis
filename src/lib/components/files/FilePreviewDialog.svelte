<script lang="ts">
	import { X, DownloadSimple, ArrowClockwise } from 'phosphor-svelte';
	import { formatFileSize } from '$lib/utils/format';
	import {
		getMediaKind,
		type FilePreviewResponse,
		type FilePreviewTarget,
		getThumbnailLabel
	} from '$lib/utils/file-preview';

	let {
		open,
		file,
		preview,
		loading,
		error,
		onClose,
		onRetry
	}: {
		open: boolean;
		file: FilePreviewTarget | null;
		preview: FilePreviewResponse | null;
		loading: boolean;
		error: string | null;
		onClose: () => void;
		onRetry: () => void;
	} = $props();

	const kind = $derived(file ? getMediaKind(file.mimeType) : 'unsupported');
	const label = $derived(
		file ? getThumbnailLabel({ name: file.name, mimeType: file.mimeType }) : ''
	);

	function closeOnEscape(e: KeyboardEvent) {
		if (!open) return;
		if (e.key === 'Escape') onClose();
	}

	function handleDialogKeydown(e: KeyboardEvent) {
		if (!open) return;
		if (e.key !== 'Escape') return;
		e.stopPropagation();
		onClose();
	}
</script>

<svelte:window onkeydown={closeOnEscape} />

{#if open && file}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-bg-app/80 p-4 backdrop-blur-sm"
		role="dialog"
		aria-modal="true"
		aria-label={file.name}
		tabindex="-1"
		onclick={onClose}
		onkeydown={handleDialogKeydown}
	>
		<div
			class="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-border-line bg-bg-panel shadow-xl"
			onclick={(e) => e.stopPropagation()}
			role="presentation"
		>
			<div class="flex items-center justify-between gap-3 border-b border-border-line px-4 py-3">
				<div class="min-w-0 flex-1">
					<h2 class="truncate text-sm font-semibold text-text-main">{file.name}</h2>
					<p class="text-xs text-text-muted">{formatFileSize(file.size)}</p>
				</div>
				<div class="flex shrink-0 items-center gap-1">
					{#if preview?.downloadUrl}
						<a
							href={preview.downloadUrl}
							download={file.name}
							class="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-700"
							aria-label="Pobierz {file.name}"
							title="Pobierz"
						>
							<DownloadSimple class="h-4 w-4" />
						</a>
					{/if}
					<button
						type="button"
						onclick={onClose}
						class="inline-flex h-9 w-9 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-700"
						aria-label="Zamknij podglad"
					>
						<X class="h-4 w-4" />
					</button>
				</div>
			</div>

			<div class="flex min-h-[200px] flex-1 items-center justify-center overflow-auto p-4">
				{#if loading}
					<p class="text-sm text-text-muted">Ładowanie podglądu…</p>
				{:else if error}
					<div class="flex flex-col items-center gap-3 text-center">
						<p class="text-sm text-red-500">{error}</p>
						<button
							type="button"
							onclick={onRetry}
							class="inline-flex items-center gap-2 rounded-md border border-border-line px-3 py-2 text-sm font-medium text-text-main hover:bg-gray-50 dark:hover:bg-zinc-800"
						>
							<ArrowClockwise class="h-4 w-4" />
							Spróbuj ponownie
						</button>
					</div>
				{:else if preview}
					{#if kind === 'image'}
						<img
							src={preview.previewUrl}
							alt={file.name}
							class="max-h-[70vh] max-w-full object-contain"
						/>
					{:else if kind === 'audio'}
						<audio src={preview.previewUrl} controls preload="metadata" class="w-full"></audio>
					{:else if kind === 'video'}
						<!-- svelte-ignore a11y_media_has_caption (user-uploaded videos do not provide caption tracks) -->
						<video
							src={preview.previewUrl}
							controls
							preload="metadata"
							class="max-h-[70vh] w-full bg-black"
						></video>
					{:else}
						<p class="text-sm text-text-muted">
							{label} – podgląd nie jest dostępny dla tego formatu.
						</p>
					{/if}
				{/if}
			</div>
		</div>
	</div>
{/if}
