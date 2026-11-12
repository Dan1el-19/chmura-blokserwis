<script lang="ts">
	import { Code, ConnectError } from '@connectrpc/connect';
	import { create } from '@bufbuild/protobuf';
	import { onMount } from 'svelte';
	import { storageSettings } from '#lib/api.js';
	import {
		GetStorageSettingsRequestSchema,
		UpdateStorageSettingsRequestSchema,
		type StorageSettings
	} from '#lib/gen/unisourcecfl/storage/v1/storage_pb.js';
	import { formatStorageAmount, parseStorageAmount } from '#lib/storage-settings.js';
	import { MAX_MULTIPART_FILE_BYTES } from '#lib/multipart/protocol.js';
	import { getCloudState } from '#lib/cloud-state.svelte.js';
	import { UploadMode } from '#lib/gen/unisourcecfl/upload/v1/upload_pb.js';
	import PageHeader from '#lib/components/ui/PageHeader.svelte';
	const app = getCloudState();
	const visibleMaxUploadBytes = $derived(
		app.multipartCapabilities?.enabled ? app.multipartCapabilities.maxFileBytes : app.uploadLimitBytes
	);

	let settings = $state<StorageSettings | null>(null);
	let disposed = false;
	let uploadMb = $state('');
	let r2Gb = $state('');
	let rustfsGb = $state('');
	let busy = $state(false);
	let error = $state('');
	let notice = $state('');
	let denied = $state(false);
	let validationAttempted = $state(false);
	const parsedUpload = $derived(parseStorageAmount(uploadMb, 'MB', BigInt(MAX_MULTIPART_FILE_BYTES)));
	const parsedR2 = $derived(settings ? parseStorageAmount(r2Gb, 'GB', settings.r2MaxCapacityBytes) : null);
	const parsedRustfs = $derived(settings ? parseStorageAmount(rustfsGb, 'GB', settings.rustfsMaxCapacityBytes) : null);

	function errorMessage(cause: unknown): string {
		if (cause instanceof ConnectError && cause.code === Code.PermissionDenied)
			return 'Brak uprawnień do zarządzania ustawieniami magazynu.';
		return cause instanceof Error ? cause.message : 'Nie udało się odczytać ustawień magazynu.';
	}

	function setForm(value: StorageSettings): void {
		settings = value;
		validationAttempted = false;
		app.adminSettings = value;
		uploadMb = formatStorageAmount(value.maxUploadBytes, 'MB');
		r2Gb = formatStorageAmount(value.r2LimitBytes, 'GB');
		rustfsGb = formatStorageAmount(value.rustfsLimitBytes, 'GB');
	}

	async function loadSettings(): Promise<void> {
		busy = true;
		const version = app.sessionVersion;
		error = '';
		denied = false;
		try {
			const response = await storageSettings.getStorageSettings(
				create(GetStorageSettingsRequestSchema)
			);
			if (disposed || version !== app.sessionVersion) return;
			if (!response.settings) throw new Error('Backend nie zwrócił ustawień magazynu.');
			setForm(response.settings);
		} catch (cause) {
			settings = null;
			error = errorMessage(cause);
			denied = cause instanceof ConnectError && cause.code === Code.PermissionDenied;
		} finally {
			busy = false;
		}
	}

	async function saveSettings(event: SubmitEvent): Promise<void> {
		event.preventDefault();
		if (!settings || busy) return;
		const version = app.sessionVersion;
		error = '';
		notice = '';
		const maxUploadBytes = parseStorageAmount(uploadMb, 'MB', BigInt(MAX_MULTIPART_FILE_BYTES));
		const r2LimitBytes = parseStorageAmount(r2Gb, 'GB', settings.r2MaxCapacityBytes);
		const rustfsLimitBytes = parseStorageAmount(rustfsGb, 'GB', settings.rustfsMaxCapacityBytes);
		validationAttempted = true;
		if (maxUploadBytes === null || r2LimitBytes === null || rustfsLimitBytes === null) {
			error = 'Wprowadź poprawne limity w obsługiwanym zakresie.';
			return;
		}
		busy = true;
		try {
			const response = await storageSettings.updateStorageSettings(
				create(UpdateStorageSettingsRequestSchema, {
					expectedRevision: settings.revision,
					maxUploadBytes,
					r2LimitBytes,
					rustfsLimitBytes
				})
			);
			if (disposed || version !== app.sessionVersion) return;
			if (!response.settings) throw new Error('Backend nie zwrócił zapisanych ustawień magazynu.');
			setForm(response.settings);
			await app.loadUploadLimit(true);
			notice = 'Ustawienia zostały zapisane.';
		} catch (cause) {
			if (cause instanceof ConnectError && cause.code === Code.Aborted) {
				await loadSettings();
				error =
					'Ustawienia zmieniły się w międzyczasie. Załadowano aktualne wartości; sprawdź je przed kolejnym zapisem.';
			} else {
				error = errorMessage(cause);
			}
		} finally {
			busy = false;
		}
	}

	async function retryUploadLimits(): Promise<void> {
		const version = app.sessionVersion;
		await app.loadUploadLimit(true);
		if (!disposed && version === app.sessionVersion && app.canManageSettings && !settings)
			await loadSettings();
	}

	function formatUsage(used: bigint, capacity: bigint): string {
		return `${formatStorageAmount(used, 'GB')} GB z ${formatStorageAmount(capacity, 'GB')} GB`;
	}

	onMount(() => {
		const version = app.sessionVersion;
		void (async () => {
			await app.loadUploadLimit();
			if (disposed || version !== app.sessionVersion || !app.canManageSettings) return;
			if (app.adminSettings) {
				setForm(app.adminSettings);
				if (app.settingsDraft) ({ uploadMb, r2Gb, rustfsGb } = app.settingsDraft);
			} else await loadSettings();
		})();
		return () => {
			disposed = true;
			if (settings && version === app.sessionVersion)
				app.settingsDraft = { uploadMb, r2Gb, rustfsGb };
		};
	});
</script>

<svelte:head><title>Ustawienia | Chmura Blokserwis</title></svelte:head>

<section class="max-w-[960px] space-y-6" aria-label="Ustawienia">
	<PageHeader title="Ustawienia" />
	<section class="space-y-4 rounded-lg border border-border-line bg-bg-panel p-5" aria-labelledby="upload-preferences-title">
		<h2 id="upload-preferences-title" class="font-semibold text-text-main">Przesyłanie</h2>
		<label class="block space-y-2 text-sm text-text-main"><span>Domyślne miejsce przechowywania</span>
			<select aria-label="Domyślne miejsce przechowywania" value={app.defaultUploadMode} onchange={(event)=>app.setDefaultUploadMode(Number(event.currentTarget.value) as UploadMode)} class="block w-full rounded-md border border-border-line bg-bg-app px-3 py-2 text-base md:text-sm"><option value={UploadMode.AUTO}>Auto</option><option value={UploadMode.R2}>R2</option><option value={UploadMode.RUSTFS}>RustFS</option></select>
		</label>
		<p class="text-xs text-text-muted">Wybór jest zapamiętywany dla tego konta w tej przeglądarce. Dotyczy nowych przesłań. Aktywne transfery zachowują wybrane wcześniej miejsce.</p>
		{#if visibleMaxUploadBytes!==null}<p class="text-sm text-text-muted">Maksymalny rozmiar pliku: {formatStorageAmount(visibleMaxUploadBytes,'MB')} MB.</p>{/if}
		{#if app.uploadLimitError}<p class="text-sm text-red-600" role="alert">{app.uploadLimitError}</p><button type="button" class="text-sm text-primary underline" onclick={()=>void retryUploadLimits()}>Ponów pobieranie limitu</button>{/if}
	</section>
	{#if app.canManageSettings}
	<header>
		<p class="text-xs font-semibold tracking-wide text-primary uppercase">Administracja magazynem</p>
		<h2 class="mt-1 font-mono text-xl font-bold text-text-main">Ustawienia magazynu</h2>
		<p class="mt-2 text-sm text-text-muted">Limity dotyczą nowych przesłań. Zmniejszenie limitu poniżej aktualnego użycia nie usuwa istniejących plików.</p>
		<p class="mt-2 text-sm text-text-muted">Użycie obejmuje pliki, rezerwacje oraz dane oczekujące na bezpieczne zwolnienie. Usunięcie pliku może nie obniżyć użycia od razu; limit zwalnia się po rozstrzygnięciu aktywnych transferów.</p>
	</header>

	{#if error}
		<div class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
			{error}
			{#if !denied && !busy}<button type="button" class="ml-2 font-medium underline" onclick={() => void loadSettings()}>Ponów próbę</button>{/if}
		</div>
	{/if}
	{#if notice}<p class="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800" role="status">{notice}</p>{/if}

	{#if settings}
		<form class="space-y-5 rounded-xl border border-border-line bg-bg-panel p-5" onsubmit={saveSettings}>
			<div class="grid gap-4 sm:grid-cols-2">
				<label class="space-y-1.5 text-sm font-medium text-text-main" for="upload-limit">Maksymalny rozmiar pliku (MB)
					<input id="upload-limit" class="w-full rounded-md border border-border-line bg-bg-app px-3 py-2 text-base md:text-sm" inputmode="decimal" autocomplete="off" bind:value={uploadMb} disabled={busy} aria-invalid={validationAttempted && parsedUpload === null ? 'true' : undefined} aria-describedby={validationAttempted && parsedUpload === null ? 'upload-limit-help upload-limit-error' : 'upload-limit-help'} />
					<span id="upload-limit-help" class="block text-xs font-normal text-text-muted">Maksymalnie 10 000 MB. Starszy pojedynczy transfer pozostaje ograniczony do 100 MB. Limit 0 MB pozwala przesyłać tylko puste pliki.</span>
					{#if validationAttempted && parsedUpload === null}<span id="upload-limit-error" class="block text-sm font-normal text-red-600 dark:text-red-300">Wprowadź limit pliku w dozwolonym zakresie.</span>{/if}
				</label>
				<label class="space-y-1.5 text-sm font-medium text-text-main" for="r2-limit">Limit R2 (GB)
					<input id="r2-limit" class="w-full rounded-md border border-border-line bg-bg-app px-3 py-2 text-base md:text-sm" inputmode="decimal" autocomplete="off" bind:value={r2Gb} disabled={busy} aria-invalid={validationAttempted && parsedR2 === null ? 'true' : undefined} aria-describedby={validationAttempted && parsedR2 === null ? 'r2-limit-help r2-limit-error' : 'r2-limit-help'} />
					<span id="r2-limit-help" class="block text-xs font-normal text-text-muted">Użycie: {formatUsage(settings.r2UsedBytes, settings.r2MaxCapacityBytes)}.</span>
					{#if validationAttempted && parsedR2 === null}<span id="r2-limit-error" class="block text-sm font-normal text-red-600 dark:text-red-300">Wprowadź limit R2 w dozwolonym zakresie.</span>{/if}
				</label>
				<label class="space-y-1.5 text-sm font-medium text-text-main" for="rustfs-limit">Limit RustFS (GB)
					<input id="rustfs-limit" class="w-full rounded-md border border-border-line bg-bg-app px-3 py-2 text-base md:text-sm" inputmode="decimal" autocomplete="off" bind:value={rustfsGb} disabled={busy} aria-invalid={validationAttempted && parsedRustfs === null ? 'true' : undefined} aria-describedby={validationAttempted && parsedRustfs === null ? 'rustfs-limit-help rustfs-limit-error' : 'rustfs-limit-help'} />
					<span id="rustfs-limit-help" class="block text-xs font-normal text-text-muted">Użycie: {formatUsage(settings.rustfsUsedBytes, settings.rustfsMaxCapacityBytes)}.</span>
					{#if validationAttempted && parsedRustfs === null}<span id="rustfs-limit-error" class="block text-sm font-normal text-red-600 dark:text-red-300">Wprowadź limit RustFS w dozwolonym zakresie.</span>{/if}
				</label>
			</div>
			{#if (parsedR2 !== null && parsedR2 < settings.r2UsedBytes) || (parsedRustfs !== null && parsedRustfs < settings.rustfsUsedBytes)}
				<p class="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900" role="status">Ustawiony limit jest niższy niż obecne użycie. Istniejące pliki pozostaną dostępne, ale nowe przesłania mogą być blokowane.</p>
			{/if}
			<div class="flex justify-end">
				<button class="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" type="submit" disabled={busy}>Zapisz ustawienia</button>
			</div>
		</form>
	{:else if !error}
		<p class="text-sm text-text-muted" aria-live="polite">Ładowanie ustawień…</p>
	{/if}
	{/if}
</section>
