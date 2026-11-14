<script lang="ts">
	import { onMount, tick } from 'svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { create } from '@bufbuild/protobuf';
	import { timestampDate } from '@bufbuild/protobuf/wkt';
	import { DownloadSimple, File as FileIcon, FileAudio, FileImage, FileVideo, SpinnerGap, X } from 'phosphor-svelte';
	import { catalog } from '#lib/api.js';
	import { capturePlayback, restorePlayback, type PlaybackSnapshot } from '#lib/media-preview.js';
	import { storageErrorMessage } from '#lib/storage-error.js';
	import { mediaKindForFilename } from '#lib/media-preview.js';
	import type { AppRouteWithQuery } from '#lib/routes.js';
	import {
		GetPreviewRequestSchema,
		PreviewMediaKind,
		type Entry,
		type GetPreviewResponse
	} from '#lib/gen/unisourcecfl/catalog/v1/catalog_pb.js';
	import AppDialog from './AppDialog.svelte';
	import TextPreview from './TextPreview.svelte';

	let {
		file,
		spaceId,
		onclose,
		ondownload
	}: {
		file: Entry;
		spaceId: string;
		onclose: () => void;
		ondownload: () => void;
	} = $props();

	let preview = $state<GetPreviewResponse>();
	let loading = $state(true);
	let error = $state('');
	let mediaElement = $state<HTMLMediaElement>();
	let pendingPlayback: PlaybackSnapshot | undefined;
	let lastPlayback: PlaybackSnapshot | undefined;
	let requestVersion = 0;
	let renewedUrl = '';
	let renewalInFlight = false;
	let renewalTimer: ReturnType<typeof setTimeout> | undefined;
	const titleId = $derived(`preview-title-${file.id}`);
	const mediaKind = $derived(mediaKindForFilename(file.name));

	function formatBytes(size: bigint | undefined): string {
		if (size === undefined) return '—';
		const bytes = Number(size);
		if (bytes < 1000) return `${bytes} B`;
		const units = ['KB', 'MB', 'GB'];
		let value = bytes / 1000;
		let unit = 0;
		while (value >= 1000 && unit < units.length - 1) { value /= 1000; unit++; }
		return `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(value)} ${units[unit]}`;
	}

	function currentPlayback(): PlaybackSnapshot | undefined {
		return capturePlayback(mediaElement);
	}

	function scheduleRenewal(expiresAt: GetPreviewResponse['expiresAt']): void {
		if (renewalTimer) clearTimeout(renewalTimer);
		if (!expiresAt) return;
		const remaining = timestampDate(expiresAt).getTime() - Date.now();
		if (remaining <= 10_000) return;
		renewalTimer = setTimeout(() => void renewPreview(), remaining - 10_000);
	}

	function restorePendingPlayback(): void {
		if (!pendingPlayback || !mediaElement || mediaElement.readyState === 0) return;
		const playback = pendingPlayback;
		pendingPlayback = undefined;
		lastPlayback = undefined;
		void restorePlayback(mediaElement, playback);
	}

	async function requestPreview(playback?: PlaybackSnapshot): Promise<void> {
		const version = ++requestVersion;
		loading = true;
		error = '';
		try {
			const result = await catalog.getPreview(
				create(GetPreviewRequestSchema, { spaceId, entryId: file.id })
			);
			if (version !== requestVersion) return;
			const sameContent = !!preview?.contentId && preview.contentId === result.contentId;
			preview = result;
			if (playback && sameContent) pendingPlayback = playback;
			else { pendingPlayback = undefined; lastPlayback = undefined; }
			await tick();
			if (version !== requestVersion) return;
			if (mediaElement?.currentSrc === result.url) restorePendingPlayback();
			scheduleRenewal(result.expiresAt);
		} catch (cause) {
			if (version === requestVersion) {
				error = storageErrorMessage(cause);
				if (!preview) error = `${error} Możesz pobrać plik zamiast go podglądać.`;
			}
		} finally {
			if (version === requestVersion) loading = false;
		}
	}

	async function renewPreview(): Promise<void> {
		if (renewalInFlight) return;
		const sourceUrl = preview?.url ?? '';
		const sourceContentId = preview?.contentId;
		if (sourceUrl && renewedUrl === sourceUrl) {
			error = 'Nie udało się odnowić podglądu. Możesz ponowić próbę albo pobrać plik.';
			return;
		}
		renewedUrl = sourceUrl;
		renewalInFlight = true;
		lastPlayback = currentPlayback() ?? lastPlayback;
		try {
			await requestPreview(lastPlayback);
			if (preview?.url !== sourceUrl || preview?.contentId !== sourceContentId) renewedUrl = '';
		} finally {
			renewalInFlight = false;
		}
	}

	function retryPreview(): void {
		renewedUrl = '';
		void requestPreview(currentPlayback() ?? lastPlayback);
	}

	onMount(() => {
		const historyToken = crypto.randomUUID();
		const currentLocation = `${page.url.pathname}${page.url.search}` as AppRouteWithQuery;
		void goto(resolve(currentLocation), {
			state: { ...(page.state ?? {}), cloudFilePreview: historyToken },
			shallow: true,
			reset: false
		});
		let closedByHistory = false;
		const handlePopState = () => {
			if (page.state?.cloudFilePreview !== historyToken) {
				closedByHistory = true;
				onclose();
			}
		};
		window.addEventListener('popstate', handlePopState);
		void requestPreview();
		return () => {
			window.removeEventListener('popstate', handlePopState);
			if (!closedByHistory && page.state?.cloudFilePreview === historyToken) history.back();
			requestVersion++;
			if (renewalTimer) clearTimeout(renewalTimer);
			if (mediaElement) {
				mediaElement.pause();
				mediaElement.removeAttribute('src');
				mediaElement.load();
			}
		};
	});
</script>

<AppDialog labelledby={titleId} wide onclose={onclose}>
	<section class="space-y-4">
		<header class="flex items-start justify-between gap-4">
			<div class="min-w-0">
				<div class="flex items-center gap-2">{#if mediaKind === 'IMAGE'}<FileImage class="h-5 w-5 shrink-0 text-primary" />{:else if mediaKind === 'AUDIO'}<FileAudio class="h-5 w-5 shrink-0 text-primary" />{:else if mediaKind === 'VIDEO'}<FileVideo class="h-5 w-5 shrink-0 text-primary" />{:else}<FileIcon class="h-5 w-5 shrink-0 text-primary" />{/if}<h2 id={titleId} class="truncate text-base font-semibold text-text-main">{file.name}</h2></div>
				<p class="mt-1 text-xs text-text-muted">{file.kind === 1 ? 'Plik' : 'Element'} · {formatBytes(file.sizeBytes)} · Utworzono {file.createdAt ? timestampDate(file.createdAt).toLocaleDateString('pl-PL') : '—'}</p>
			</div>
			<button type="button" onclick={onclose} class="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-text-muted hover:bg-gray-100 hover:text-text-main dark:hover:bg-zinc-800" aria-label="Zamknij podgląd">
				<X class="h-5 w-5" />
			</button>
		</header>

		{#if error}
			<div class="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200" role="alert">
				<p>{error}</p>
				<div class="mt-3 flex flex-wrap gap-2">
					<button type="button" onclick={retryPreview} class="rounded-md border border-current px-3 py-2 text-xs font-medium">Spróbuj ponownie</button>
					<button type="button" onclick={ondownload} class="rounded-md bg-primary px-3 py-2 text-xs font-medium text-white"><DownloadSimple class="mr-1 inline h-4 w-4" />Pobierz plik</button>
				</div>
			</div>
		{:else if loading && !preview}
			<div class="flex min-h-48 items-center justify-center gap-2 text-sm text-text-muted" role="status"><SpinnerGap class="h-5 w-5 animate-spin" />Przygotowywanie podglądu…</div>
		{:else if preview}
			{#key `${preview.contentId}:${preview.url}`}
			{#if preview.mediaKind === PreviewMediaKind.PDF}
				<iframe title={`Podgląd PDF: ${file.name}`} src={preview.url} sandbox="allow-scripts allow-same-origin" referrerpolicy="no-referrer" class="h-[65dvh] w-full rounded-md border border-border-line"></iframe>
			{:else if preview.mediaKind === PreviewMediaKind.TEXT}
				<TextPreview url={preview.url} sizeBytes={file.sizeBytes === undefined ? undefined : Number(file.sizeBytes)} />
			{:else if preview.mediaKind === PreviewMediaKind.IMAGE}
				<img class="mx-auto max-h-[65dvh] max-w-full rounded-md object-contain" src={preview.url} alt={file.name} onerror={() => void renewPreview()} />
			{:else if preview.mediaKind === PreviewMediaKind.AUDIO}
				<audio bind:this={mediaElement} class="w-full" controls preload="metadata" src={preview.url} onerror={() => void renewPreview()} onloadedmetadata={restorePendingPlayback}></audio>
			{:else if preview.mediaKind === PreviewMediaKind.VIDEO}
				<!-- svelte-ignore a11y_media_has_caption -->
				<video bind:this={mediaElement} aria-label="Odtwarzacz wideo: {file.name}" class="mx-auto max-h-[65dvh] max-w-full rounded-md bg-black" controls playsinline preload="metadata" src={preview.url} onerror={() => void renewPreview()} onloadedmetadata={restorePendingPlayback}></video>
			{:else}
				<p class="rounded-md bg-bg-app p-4 text-sm text-text-muted">Nie można wyświetlić tego typu pliku. Możesz go pobrać.</p>
			{/if}
			{/key}
		{/if}

		<footer class="flex justify-end gap-2 border-t border-border-line pt-3">
			<button type="button" onclick={onclose} class="rounded-md border border-border-line px-3 py-2 text-sm text-text-muted hover:bg-gray-100 dark:hover:bg-zinc-800">Zamknij</button>
			<button type="button" onclick={ondownload} class="rounded-md bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"><DownloadSimple class="mr-1 inline h-4 w-4" />Pobierz</button>
		</footer>
	</section>
</AppDialog>
