<script lang="ts">
	import { onDestroy, tick, untrack } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { DownloadSimple, SpinnerGap } from 'phosphor-svelte';
	import favicon from '#lib/assets/favicon.svg';
	import { mediaKindForFilename, type BrowserMediaKind as MediaKind } from '#lib/media-preview.js';

	type Preview = { url: string; expiresAt: string; contentType: string; mediaKind: MediaKind };
	type PublicShare = {
		name: string;
		sizeBytes: number;
		preview: Preview | null;
		requiresPassword: boolean;
		maxDownloads: number | null;
		downloadCount: number;
		remainingDownloads: number | null;
		downloadLimitReached: boolean;
		viewCount: number;
	};

	const address = $derived(page.params.address ?? '');
	let share = $state<PublicShare>();
	let error = $state('');
	let loading = $state(true);
	let mediaElement = $state<HTMLMediaElement>();
	let requestVersion = 0;
	let renewalTimer: ReturnType<typeof setTimeout> | undefined;
	let renewedUrl = '';
	let pendingPlayback: { currentTime: number; paused: boolean } | undefined;
	let password = $state('');
	let unlockPending = $state(false);
	let unlockError = $state('');
	let downloadRequestId = $state('');

	function sharePath(suffix: string, shareAddress = address): string {
		return `/s/${encodeURIComponent(shareAddress)}${suffix}`;
	}

	function formatBytes(value: number): string {
		if (value < 1000) return `${value} B`;
		const units = ['KB', 'MB', 'GB'];
		let size = value / 1000;
		let unit = 0;
		while (size >= 1000 && unit < units.length - 1) { size /= 1000; unit++; }
		return `${new Intl.NumberFormat('pl-PL', { maximumFractionDigits: 1 }).format(size)} ${units[unit]}`;
	}

	function scheduleRenewal(preview: Preview | null, shareAddress: string): void {
		if (renewalTimer) clearTimeout(renewalTimer);
		if (!preview) return;
		const remaining = new Date(preview.expiresAt).getTime() - Date.now();
		if (remaining <= 10_000) return;
		renewalTimer = setTimeout(() => void loadShare(true, shareAddress), remaining - 10_000);
	}

	async function loadShare(preservePlayback = false, shareAddress = address): Promise<void> {
		const version = ++requestVersion;
		if (renewalTimer) clearTimeout(renewalTimer);
		renewalTimer = undefined;
		const previousUrl = share?.preview?.url ?? '';
		if (preservePlayback && mediaElement && !mediaElement.paused) {
			pendingPlayback = { currentTime: mediaElement.currentTime, paused: false };
		} else if (preservePlayback && mediaElement) {
			pendingPlayback = { currentTime: mediaElement.currentTime, paused: true };
		}
		try {
			const response = await fetch(sharePath('/info', shareAddress), {
				cache: 'no-store',
				referrerPolicy: 'no-referrer'
			});
			if (version !== requestVersion) return;
			if (!response.ok) {
				error = response.status === 404 ? 'Ten link jest niedostępny, wygasł lub został unieważniony.' : 'Nie udało się otworzyć udostępnionego pliku. Spróbuj ponownie później.';
				share = undefined;
				return;
			}
			const result = await response.json() as PublicShare;
			if (version !== requestVersion) return;
			share = result;
			error = '';
			unlockError = '';
			await tick();
			if (previousUrl && previousUrl === result.preview?.url) {
				error = 'Nie udało się odnowić podglądu. Plik nadal można pobrać.';
				pendingPlayback = undefined;
			} else if (!result.preview) pendingPlayback = undefined;
			scheduleRenewal(result.preview, shareAddress);
		} catch {
			if (version === requestVersion) error = 'Nie udało się połączyć z Chmurą Blokserwis. Sprawdź połączenie i spróbuj ponownie.';
		} finally {
			if (version === requestVersion) loading = false;
		}
	}

	async function unlockShare(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (unlockPending || !password) return;
		unlockPending = true;
		unlockError = '';
		try {
			const response = await fetch(sharePath('/unlock'), {
				method: 'POST',
				cache: 'no-store',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ password, requestId: crypto.randomUUID() })
			});
			password = '';
			if (!response.ok) {
				unlockError = response.status === 429
					? 'Zbyt wiele prób. Odczekaj chwilę i spróbuj ponownie.'
					: response.status === 401 ? 'Hasło jest nieprawidłowe.' : 'Nie udało się odblokować linku. Spróbuj ponownie.';
				return;
			}
			await loadShare();
		} catch {
			unlockError = 'Nie udało się połączyć z Chmurą Blokserwis. Spróbuj ponownie.';
		} finally {
			unlockPending = false;
		}
	}

	function restorePosition(): void {
		const playback = pendingPlayback;
		if (!playback || !mediaElement || mediaElement.readyState === 0) return;
		pendingPlayback = undefined;
		mediaElement.currentTime = playback.currentTime;
		if (!playback.paused) void mediaElement.play().catch(() => {});
	}

	function renewAfterMediaError(): void {
		const currentUrl = share?.preview?.url ?? '';
		if (!currentUrl || renewedUrl === currentUrl) return;
		renewedUrl = currentUrl;
		void loadShare(true).then(() => {
			if (share?.preview?.url !== currentUrl) renewedUrl = '';
		});
	}

	$effect(() => {
		const currentAddress = address;
		if (!currentAddress) return;
		untrack(() => {
			if (mediaElement) {
				mediaElement.pause();
				mediaElement.removeAttribute('src');
				mediaElement.load();
				mediaElement = undefined;
			}
			share = undefined;
			error = '';
			password = '';
			unlockError = '';
			loading = true;
			pendingPlayback = undefined;
			renewedUrl = '';
			downloadRequestId = crypto.randomUUID();
			const visitId = crypto.randomUUID();
			void fetch(sharePath('/visit', currentAddress), {
				method: 'POST',
				cache: 'no-store',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ viewId: visitId })
			}).catch(() => {}).finally(() => void loadShare(false, currentAddress));
		});
	});
	onDestroy(() => {
		requestVersion++;
		if (renewalTimer) clearTimeout(renewalTimer);
		if (mediaElement) {
			mediaElement.pause();
			mediaElement.removeAttribute('src');
			mediaElement.load();
		}
	});
</script>

<svelte:head>
	<title>{share?.name ? `${share.name} | Chmura Blokserwis` : 'Udostępniony plik | Chmura Blokserwis'}</title>
	<meta name="robots" content="noindex, nofollow, noarchive" />
	<meta name="referrer" content="no-referrer" />
</svelte:head>

<main class="min-h-dvh bg-bg-app px-4 py-8 text-text-main sm:px-6 sm:py-12">
	<div class="mx-auto w-full max-w-3xl">
		<header class="mb-8 flex items-center gap-3">
			<a href={resolve('/')} aria-label="Otwórz Chmurę Blokserwis" class="flex items-center gap-3 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
				<img src={favicon} alt="" class="h-9 w-9" />
				<span class="font-mono text-lg font-bold tracking-tight">Chmura Blokserwis</span>
			</a>
		</header>

		<section class="overflow-hidden rounded-lg border border-border-line bg-bg-panel shadow-sm">
			{#if loading}
				<div class="flex min-h-72 items-center justify-center gap-3 p-8 text-sm text-text-muted" role="status"><SpinnerGap class="h-5 w-5 animate-spin" />Ładowanie udostępnionego pliku…</div>
			{:else if error && !share}
				<div class="flex min-h-60 flex-col items-center justify-center px-6 py-12 text-center"><h1 class="text-xl font-semibold">Plik jest niedostępny</h1><p class="mt-3 max-w-md text-sm leading-6 text-text-muted">{error}</p><button type="button" onclick={() => void loadShare()} class="mt-5 min-h-11 rounded-md border border-border-line px-4 text-sm font-medium hover:bg-gray-50 dark:hover:bg-zinc-800">Spróbuj ponownie</button></div>
			{:else if share}
				<div class="space-y-5 p-5 sm:p-8">
					{#if share.requiresPassword}
						<div class="mx-auto max-w-md py-8"><h1 class="text-center text-xl font-semibold">Udostępniony plik jest chroniony hasłem</h1><p class="mt-2 text-center text-sm text-text-muted">Wprowadź hasło, aby zobaczyć plik i pobrać go.</p><form onsubmit={unlockShare} class="mt-6 space-y-3"><label class="block space-y-1.5 text-sm"><span>Hasło</span><input type="password" bind:value={password} autocomplete="current-password" required disabled={unlockPending} class="w-full rounded-md border border-border-line bg-bg-app px-3 py-2.5 focus:border-primary focus:outline-none" /></label>{#if unlockError}<p class="text-sm text-red-600 dark:text-red-300" role="alert">{unlockError}</p>{/if}<button type="submit" disabled={unlockPending || !password} class="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{#if unlockPending}<SpinnerGap class="h-4 w-4 animate-spin" />{:else}<DownloadSimple class="h-4 w-4" />{/if}Odblokuj</button></form></div>
					{:else}
						<div class="min-w-0"><h1 class="break-words text-xl font-semibold sm:text-2xl">{share.name}</h1><p class="mt-1 text-sm text-text-muted">{formatBytes(share.sizeBytes)}</p><p class="mt-2 text-xs text-text-muted">Wejścia: {share.viewCount} · Pobrania: {share.downloadCount}{share.maxDownloads === null ? '' : ` / ${share.maxDownloads}`}</p></div>
						{#if share.preview && mediaKindForFilename(share.name) === 'IMAGE'}
							<div class="flex max-h-[65dvh] items-center justify-center overflow-hidden rounded-md bg-black/5 p-2 dark:bg-black/30"><img src={share.preview.url} alt={share.name} onerror={renewAfterMediaError} class="max-h-[62dvh] max-w-full object-contain" /></div>
						{:else if share.preview && mediaKindForFilename(share.name) === 'AUDIO'}
							<audio bind:this={mediaElement} src={share.preview.url} controls preload="metadata" onloadedmetadata={restorePosition} onerror={renewAfterMediaError} class="w-full" aria-label={`Odtwarzacz audio: ${share.name}`}></audio>
						{:else if share.preview && mediaKindForFilename(share.name) === 'VIDEO'}
							<!-- svelte-ignore a11y_media_has_caption -->
							<video bind:this={mediaElement} src={share.preview.url} controls preload="metadata" onloadedmetadata={restorePosition} onerror={renewAfterMediaError} class="max-h-[65dvh] w-full rounded-md bg-black" aria-label={`Odtwarzacz wideo: ${share.name}`}></video>
						{/if}
						{#if error}<div class="rounded-md bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200" role="status"><p>{error}</p><button type="button" onclick={() => void loadShare(true)} class="mt-2 font-semibold underline">Ponów odnowienie podglądu</button></div>{/if}
						{#if share.downloadLimitReached}<p class="rounded-md bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200" role="status">Limit pobrań został wyczerpany. Nowe pobrania i podgląd są zablokowane.</p>
						{:else}<form method="GET" action={resolve('/s/[address]/download', { address })}><input type="hidden" name="requestId" value={downloadRequestId} /><button type="submit" class="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 sm:w-auto"><DownloadSimple class="h-5 w-5" />Pobierz</button></form>{/if}
					{/if}
				</div>
			{/if}
		</section>
		<footer class="mt-5 text-center text-xs text-text-muted">Udostępniono przez Chmurę Blokserwis</footer>
	</div>
</main>
