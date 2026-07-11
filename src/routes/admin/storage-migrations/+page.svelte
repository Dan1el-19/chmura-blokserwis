<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		ArrowRight,
		ArrowsClockwise,
		CheckCircle,
		Clock,
		Copy,
		Database,
		File,
		WarningCircle
	} from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { formatFileSize } from '$lib/utils/format';

	let { data, form } = $props();
	let isSubmitting = $state(false);

	type EventLevel = 'info' | 'warning' | 'error';
	type StorageEndpoint = {
		provider: string | null;
		bucket: string | null;
		key?: string | null;
		file_id?: string | null;
	};
	type MigrationEventInput = {
		id?: string;
		run_id?: string | null;
		item_id?: string | null;
		file_id?: string | null;
		event_type?: string | null;
		level?: EventLevel;
		message?: string | null;
		file_name?: string | null;
		file_size?: number | null;
		trigger?: 'scheduled' | 'manual' | 'fast_upload' | null;
		origin?: string | null;
		source?: StorageEndpoint | null;
		destination?: StorageEndpoint | null;
		from_state?: string | null;
		to_state?: string | null;
		bytes_completed?: number | null;
		expected_size?: number | null;
		progress_percent?: number | null;
		attempt_count?: number | null;
		retry_at?: string | null;
		error_code?: string | null;
		error_message?: string | null;
		duration_ms?: number | null;
		metadata?: Record<string, unknown> | null;
		created_at?: string | null;
	};
	type MigrationRunInput = {
		id: string;
		status: string;
		dry_run: boolean;
		files_total: number;
		files_completed: number;
		files_failed: number;
		bytes_transferred: number;
		started_at: string | null;
		finished_at: string | null;
		trigger?: 'scheduled' | 'manual' | 'fast_upload' | null;
		requested_by?: string | null;
		duration_ms?: number | null;
	};

	const dashboard = $derived(data.dashboard);
	const activeRun = $derived(
		dashboard.active_run ? normalizeRun(dashboard.active_run as MigrationRunInput) : null
	);
	const recentRuns = $derived(
		dashboard.recent_runs.map((run) => normalizeRun(run as MigrationRunInput))
	);
	const recentEvents = $derived(
		dashboard.recent_events.map((event) => normalizeEvent(event as MigrationEventInput))
	);
	const r2Percent = $derived(
		dashboard.r2_high_watermark_bytes > 0
			? Math.min(100, (dashboard.r2_used_bytes / dashboard.r2_high_watermark_bytes) * 100)
			: 0
	);

	function statusLabel(status: string) {
		return (
			{
				planned: 'W kolejce',
				running: 'W trakcie',
				completed: 'Zakończona',
				not_needed: 'Niepotrzebna',
				cancelled: 'Anulowana'
			}[status] ?? status
		);
	}

	function normalizeRun(run: MigrationRunInput) {
		return {
			...run,
			trigger: run.trigger || null,
			requested_by: run.requested_by || null,
			duration_ms: numberOrNull(run.duration_ms)
		};
	}

	function normalizeEvent(event: MigrationEventInput) {
		const eventType = event.event_type || 'migration_event';
		const expectedSize = numberOrNull(event.expected_size ?? event.file_size);
		const bytesCompleted = numberOrNull(event.bytes_completed);
		const calculatedProgress =
			expectedSize && bytesCompleted !== null ? (bytesCompleted / expectedSize) * 100 : null;

		return {
			id: event.id || `${eventType}-${event.created_at || 'unknown'}`,
			run_id: event.run_id || null,
			item_id: event.item_id || null,
			file_id: event.file_id || null,
			event_type: eventType,
			level: event.level || inferLevel(eventType),
			message: event.message || eventType.replaceAll('_', ' '),
			file_name: event.file_name || null,
			file_size: numberOrNull(event.file_size ?? event.expected_size),
			trigger: event.trigger || null,
			origin: event.origin || null,
			source: event.source || null,
			destination: event.destination || null,
			from_state: event.from_state || null,
			to_state: event.to_state || null,
			bytes_completed: bytesCompleted,
			expected_size: expectedSize,
			progress_percent: clampPercent(numberOrNull(event.progress_percent) ?? calculatedProgress),
			attempt_count: numberOrNull(event.attempt_count),
			retry_at: event.retry_at || null,
			error_code: event.error_code || null,
			error_message: event.error_message || null,
			duration_ms: numberOrNull(event.duration_ms),
			metadata: event.metadata && typeof event.metadata === 'object' ? event.metadata : {},
			created_at: event.created_at || null
		};
	}

	function numberOrNull(value: number | null | undefined) {
		return typeof value === 'number' && Number.isFinite(value) ? value : null;
	}

	function clampPercent(value: number | null) {
		return value === null ? null : Math.max(0, Math.min(100, value));
	}

	function inferLevel(eventType: string): EventLevel {
		if (eventType.includes('failed') || eventType.includes('conflict')) return 'error';
		if (eventType.includes('retry') || eventType.includes('skipped')) return 'warning';
		return 'info';
	}

	function eventTitle(event: ReturnType<typeof normalizeEvent>) {
		const fallbackMessage = event.event_type.replaceAll('_', ' ');
		if (event.message !== fallbackMessage) return event.message;

		return (
			{
				run_created: 'Utworzono uruchomienie migracji',
				run_not_needed: 'Migracja nie była potrzebna',
				fast_upload_queued: 'Fast Upload dodany do migracji',
				runner_dispatch_requested: 'Wysłano żądanie natychmiastowego startu runnera',
				runner_dispatch_accepted: 'Runner przyjął żądanie uruchomienia',
				runner_dispatch_failed: 'Nie udało się uruchomić runnera',
				runner_dispatch_skipped: 'Natychmiastowy start runnera nie jest skonfigurowany',
				leased: 'Runner podjął plik',
				copy_started: 'Rozpoczęto kopiowanie',
				copy_progress: 'Kopiowanie w toku',
				copy_completed: 'Zakończono kopiowanie danych',
				verified: 'Zweryfikowano plik w Appwrite',
				switched: 'Przełączono plik na Appwrite',
				conflicted: 'Wykryto konflikt podczas przełączania',
				item_retry_scheduled: 'Zaplanowano ponowną próbę migracji pliku',
				item_failed: 'Migracja pliku zakończyła się błędem',
				source_cleanup_completed: 'Usunięto kopię źródłową z R2',
				source_cleanup_failed: 'Nie udało się usunąć kopii z R2',
				run_completed: 'Zakończono uruchomienie migracji',
				run_cancelled: 'Anulowano uruchomienie migracji'
			}[event.event_type] ?? fallbackMessage
		);
	}

	function stateLabel(state: string) {
		return (
			{
				queued: 'W kolejce',
				leased: 'Podjęty przez runner',
				copying: 'Kopiowanie',
				verifying: 'Weryfikacja',
				switched: 'Przełączony na Appwrite',
				source_cleanup: 'Czyszczenie R2',
				completed: 'Zakończony',
				failed: 'Błąd',
				skipped_size_limit: 'Pominięty przez limit rozmiaru',
				cancelled: 'Anulowany',
				conflicted: 'Konflikt'
			}[state] ?? state.replaceAll('_', ' ')
		);
	}

	function triggerLabel(trigger: string) {
		return (
			{
				scheduled: 'Harmonogram',
				manual: 'Ręczne uruchomienie',
				fast_upload: 'Fast Upload'
			}[trigger] ?? trigger.replaceAll('_', ' ')
		);
	}

	function formatTimestamp(value: string | null | undefined) {
		if (!value) return 'Czas niedostępny';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return value;
		return new Intl.DateTimeFormat('pl-PL', {
			dateStyle: 'medium',
			timeStyle: 'medium'
		}).format(date);
	}

	function formatDuration(durationMs: number) {
		if (durationMs < 1000) return `${Math.round(durationMs)} ms`;
		if (durationMs < 60_000) return `${(durationMs / 1000).toFixed(1)} s`;
		return `${Math.floor(durationMs / 60_000)} min ${Math.round((durationMs % 60_000) / 1000)} s`;
	}

	function shortId(value: string) {
		return value.length > 18 ? `${value.slice(0, 8)}…${value.slice(-6)}` : value;
	}

	function levelLabel(level: EventLevel) {
		return level === 'error' ? 'Błąd' : level === 'warning' ? 'Ostrzeżenie' : 'Informacja';
	}

	function levelCardClass(level: EventLevel) {
		if (level === 'error') return 'border-red-200/80 dark:border-red-900/60';
		if (level === 'warning') return 'border-amber-200/80 dark:border-amber-900/60';
		return 'border-border-line';
	}

	function levelIconClass(level: EventLevel) {
		if (level === 'error') return 'bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-400';
		if (level === 'warning')
			return 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400';
		return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400';
	}

	function correlationEntries(event: ReturnType<typeof normalizeEvent>) {
		return [
			{ label: 'Uruchomienie', value: event.run_id },
			{ label: 'Pozycja kolejki', value: event.item_id },
			{ label: 'Plik', value: event.file_id },
			{ label: 'Plik Appwrite', value: event.destination?.file_id || null },
			{ label: 'Zdarzenie', value: event.id }
		].filter((entry): entry is { label: string; value: string } => Boolean(entry.value));
	}

	function hasMetadata(event: ReturnType<typeof normalizeEvent>) {
		return Object.keys(event.metadata).length > 0;
	}

	function metadataJson(metadata: Record<string, unknown>) {
		try {
			return JSON.stringify(metadata, null, 2);
		} catch {
			return 'Nie udało się wyświetlić metadanych.';
		}
	}

	async function copyValue(label: string, value: string) {
		try {
			await navigator.clipboard.writeText(value);
			toast.success(`${label}: skopiowano identyfikator`);
		} catch {
			toast.error('Nie udało się skopiować identyfikatora');
		}
	}
</script>

<div class="space-y-6">
	<header class="border-b border-border-line pb-4">
		<h2 class="text-lg font-semibold text-text-main">Migracje plików</h2>
		<p class="mt-1 text-sm text-text-muted">
			Kolejka przenosi pliki z Cloudflare R2 do Appwrite bez przerywania dostępu do nich.
		</p>
	</header>

	<div class="grid gap-4 lg:grid-cols-3">
		<Card title="Cloudflare R2" class="lg:col-span-2">
			<div class="space-y-3">
				<div class="flex items-end justify-between gap-4">
					<div class="flex items-center gap-3">
						<div class="rounded-full bg-blue-100/50 p-2.5 dark:bg-blue-900/20">
							<Database class="h-5 w-5 text-primary" />
						</div>
						<div>
							<p class="font-mono text-2xl font-bold text-text-main">
								{formatFileSize(dashboard.r2_used_bytes)}
							</p>
							<p class="text-xs text-text-muted">
								Start powyżej {formatFileSize(dashboard.r2_high_watermark_bytes)}, cel {formatFileSize(
									dashboard.r2_low_watermark_bytes
								)}
							</p>
						</div>
					</div>
					<span class="font-mono text-sm text-text-muted">{r2Percent.toFixed(1)}%</span>
				</div>
				<div class="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-800">
					<div
						class="h-full rounded-full bg-primary transition-[width]"
						style:width={`${r2Percent}%`}
					></div>
				</div>
			</div>
		</Card>

		<Card title="Uruchomienie">
			<form
				method="POST"
				action="?/startRun"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ result, update }) => {
						isSubmitting = false;
						if (result.type === 'success') {
							toast.success('Migracja została dodana do kolejki');
							if (typeof result.data?.runnerWarning === 'string')
								toast.warning(result.data.runnerWarning);
						}
						if (result.type === 'failure') {
							const message =
								typeof result.data?.error === 'string'
									? result.data.error
									: 'Nie udało się uruchomić';
							toast.error(message);
						}
						await update();
					};
				}}
				class="space-y-3"
			>
				<label class="flex items-start gap-2 text-sm text-text-muted">
					<input type="checkbox" name="dry_run" value="true" class="mt-0.5" />
					<span>Próba na sucho — planuje pliki i zapisuje log, ale nie kopiuje danych.</span>
				</label>
				<Button
					type="submit"
					variant="primary"
					class="w-full gap-2"
					disabled={isSubmitting || activeRun?.status === 'running'}
				>
					<ArrowsClockwise class="h-4 w-4" weight="bold" />
					{isSubmitting
						? 'Uruchamianie…'
						: activeRun?.status === 'running'
							? 'Migracja trwa'
							: 'Uruchom teraz'}
				</Button>
			</form>
		</Card>
	</div>

	<Card title="Bieżące zadanie">
		{#if activeRun}
			<div class="space-y-4">
				<div class="grid gap-4 sm:grid-cols-4">
					<div>
						<p class="text-xs text-text-muted">Stan</p>
						<p class="mt-1 font-medium text-text-main">{statusLabel(activeRun.status)}</p>
					</div>
					<div>
						<p class="text-xs text-text-muted">Tryb</p>
						<p class="mt-1 font-medium text-text-main">
							{activeRun.dry_run ? 'Próba na sucho' : 'Migracja'}
						</p>
					</div>
					<div>
						<p class="text-xs text-text-muted">Pliki</p>
						<p class="mt-1 font-mono text-text-main">
							{activeRun.files_completed}/{activeRun.files_total}
						</p>
					</div>
					<div>
						<p class="text-xs text-text-muted">Przeniesiono</p>
						<p class="mt-1 font-mono text-text-main">
							{formatFileSize(activeRun.bytes_transferred)}
						</p>
					</div>
				</div>
				<div
					class="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border-line pt-4 text-xs text-text-muted"
				>
					{#if activeRun.trigger}
						<span>
							Wyzwalacz:
							<strong class="font-medium text-text-main">{triggerLabel(activeRun.trigger)}</strong>
						</span>
					{/if}
					<span>
						Start: <time datetime={activeRun.started_at || undefined}
							>{formatTimestamp(activeRun.started_at)}</time
						>
					</span>
					{#if activeRun.duration_ms !== null}
						<span
							>Czas: <strong class="font-mono text-text-main"
								>{formatDuration(activeRun.duration_ms)}</strong
							></span
						>
					{/if}
					{#if activeRun.requested_by}
						<span class="font-mono" title={activeRun.requested_by}>
							Zlecił: {shortId(activeRun.requested_by)}
						</span>
					{/if}
					<span class="font-mono" title={activeRun.id}>Run: {shortId(activeRun.id)}</span>
					<button
						type="button"
						class="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-gray-100 hover:text-text-main focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:hover:bg-zinc-800"
						onclick={() => copyValue('Uruchomienie', activeRun.id)}
						aria-label="Skopiuj identyfikator bieżącego uruchomienia"
					>
						<Copy class="h-3 w-3" />
						Kopiuj ID
					</button>
				</div>
			</div>
		{:else}
			<p class="text-sm text-text-muted">
				Brak aktywnej migracji. Harmonogram nocny uruchomi kolejkę po przekroczeniu progu.
			</p>
		{/if}
	</Card>

	<div class="grid items-start gap-6 2xl:grid-cols-[minmax(20rem,0.7fr)_minmax(0,1.3fr)]">
		<Card title="Ostatnie uruchomienia">
			{#if recentRuns.length}
				<div class="divide-y divide-border-line text-sm">
					{#each recentRuns as run (run.id)}
						<div class="space-y-2 py-3 first:pt-0 last:pb-0">
							<div class="flex items-start justify-between gap-4">
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-2">
										<p class="font-medium text-text-main">{statusLabel(run.status)}</p>
										{#if run.trigger}
											<span
												class="rounded-full border border-border-line bg-gray-50 px-2 py-0.5 text-[11px] text-text-muted dark:bg-zinc-900"
											>
												{triggerLabel(run.trigger)}
											</span>
										{/if}
									</div>
									<p class="mt-0.5 text-xs text-text-muted">
										{run.dry_run
											? 'Próba na sucho'
											: `${run.files_completed}/${run.files_total} plików`}
										· {formatTimestamp(run.started_at)}
									</p>
								</div>
								<div class="shrink-0 text-right">
									<p class="font-mono text-xs text-text-main">
										{formatFileSize(run.bytes_transferred)}
									</p>
									{#if run.duration_ms !== null}
										<p class="mt-0.5 text-[11px] text-text-muted">
											{formatDuration(run.duration_ms)}
										</p>
									{/if}
								</div>
							</div>
							<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted">
								<span class="font-mono" title={run.id}>Run {shortId(run.id)}</span>
								{#if run.requested_by}
									<span class="font-mono" title={run.requested_by}>
										Zlecił {shortId(run.requested_by)}
									</span>
								{/if}
								<button
									type="button"
									class="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-gray-100 hover:text-text-main focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:hover:bg-zinc-800"
									onclick={() => copyValue('Uruchomienie', run.id)}
									aria-label="Skopiuj identyfikator uruchomienia"
								>
									<Copy class="h-3 w-3" />
									Kopiuj ID
								</button>
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-text-muted">Nie ma jeszcze zapisanych uruchomień.</p>
			{/if}
		</Card>

		<Card
			title="Dziennik migracji"
			description="Każde zdarzenie pokazuje plik, trasę danych, postęp i identyfikatory korelacyjne."
		>
			{#if recentEvents.length}
				<ol class="space-y-6" aria-label="Oś zdarzeń migracji">
					{#each recentEvents as event, index (event.id)}
						<li class="relative pl-12">
							{#if index < recentEvents.length - 1}
								<span
									class="absolute top-10 -bottom-6 left-[1.125rem] w-px bg-border-line"
									aria-hidden="true"
								></span>
							{/if}
							<span
								class="absolute top-0 left-0 flex h-9 w-9 items-center justify-center rounded-full ring-4 ring-bg-panel {levelIconClass(
									event.level
								)}"
								title={levelLabel(event.level)}
							>
								{#if event.level === 'error'}
									<WarningCircle class="h-4 w-4" weight="fill" />
								{:else if event.level === 'warning'}
									<Clock class="h-4 w-4" weight="bold" />
								{:else}
									<CheckCircle class="h-4 w-4" weight="fill" />
								{/if}
								<span class="sr-only">{levelLabel(event.level)}</span>
							</span>

							<article
								class="rounded-md border bg-gray-50/40 p-4 dark:bg-zinc-900/30 {levelCardClass(
									event.level
								)}"
							>
								<header class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
									<div class="min-w-0">
										<div class="flex flex-wrap items-center gap-2">
											<h4 class="font-medium text-text-main">{eventTitle(event)}</h4>
											<span
												class="rounded border border-border-line bg-bg-panel px-1.5 py-0.5 font-mono text-[10px] text-text-muted"
											>
												{event.event_type}
											</span>
										</div>
										{#if event.run_id}
											<p class="mt-1 font-mono text-[11px] text-text-muted" title={event.run_id}>
												Run {shortId(event.run_id)}
												{#if event.item_id}
													· Item {shortId(event.item_id)}{/if}
											</p>
										{/if}
									</div>
									<time
										class="shrink-0 text-xs text-text-muted"
										datetime={event.created_at || undefined}
									>
										{formatTimestamp(event.created_at)}
									</time>
								</header>

								{#if event.file_name || event.file_id}
									<div class="mt-4 flex min-w-0 items-start gap-2">
										<File class="mt-0.5 h-4 w-4 shrink-0 text-text-muted" />
										<div class="min-w-0">
											<p class="break-words font-medium text-text-main">
												{event.file_name || 'Plik bez zapisanej nazwy'}
											</p>
											<p class="mt-0.5 font-mono text-[11px] text-text-muted">
												{#if event.file_id}<span title={event.file_id}
														>File {shortId(event.file_id)}</span
													>{/if}
												{#if event.file_id && event.file_size !== null}<span> · </span>{/if}
												{#if event.file_size !== null}<span>{formatFileSize(event.file_size)}</span
													>{/if}
											</p>
										</div>
									</div>
								{/if}

								{#if event.from_state || event.to_state}
									<div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
										<span class="text-text-muted">Stan</span>
										{#if event.from_state && event.to_state && event.from_state !== event.to_state}
											<span class="rounded bg-gray-100 px-2 py-1 text-text-main dark:bg-zinc-800">
												{stateLabel(event.from_state)}
											</span>
											<ArrowRight class="h-3.5 w-3.5 text-text-muted" />
											<span
												class="rounded bg-gray-100 px-2 py-1 font-medium text-text-main dark:bg-zinc-800"
											>
												{stateLabel(event.to_state)}
											</span>
										{:else}
											<span
												class="rounded bg-gray-100 px-2 py-1 font-medium text-text-main dark:bg-zinc-800"
											>
												{stateLabel(event.to_state || event.from_state || '')}
											</span>
										{/if}
									</div>
								{/if}

								{#if event.source || event.destination || event.item_id || event.file_id}
									<div
										class="mt-4 grid gap-2 rounded-md border border-border-line bg-bg-panel p-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center"
									>
										<div class="min-w-0">
											<p class="text-[10px] font-semibold tracking-wide text-text-muted uppercase">
												Źródło
											</p>
											<p class="mt-0.5 text-sm font-medium text-text-main">Cloudflare R2</p>
											{#if event.source?.bucket}
												<p
													class="mt-0.5 truncate font-mono text-[11px] text-text-muted"
													title={event.source.bucket}
												>
													Bucket: {event.source.bucket}
												</p>
											{/if}
											{#if event.source?.key}
												<p
													class="truncate font-mono text-[11px] text-text-muted"
													title={event.source.key}
												>
													Key: {event.source.key}
												</p>
											{/if}
										</div>
										<div class="flex items-center justify-center text-primary" aria-hidden="true">
											<ArrowRight class="h-5 w-5 rotate-90 sm:rotate-0" weight="bold" />
										</div>
										<div class="min-w-0 sm:text-right">
											<p class="text-[10px] font-semibold tracking-wide text-text-muted uppercase">
												Cel
											</p>
											<p class="mt-0.5 text-sm font-medium text-text-main">Appwrite Cloud</p>
											{#if event.destination?.bucket}
												<p
													class="mt-0.5 truncate font-mono text-[11px] text-text-muted"
													title={event.destination.bucket}
												>
													Bucket: {event.destination.bucket}
												</p>
											{/if}
											{#if event.destination?.file_id}
												<p
													class="truncate font-mono text-[11px] text-text-muted"
													title={event.destination.file_id}
												>
													File: {event.destination.file_id}
												</p>
											{/if}
										</div>
									</div>
								{/if}

								{#if event.progress_percent !== null || event.bytes_completed !== null}
									<div class="mt-4">
										<div class="flex items-center justify-between gap-3 text-xs text-text-muted">
											<span>Postęp kopiowania</span>
											<span class="font-mono text-text-main">
												{#if event.bytes_completed !== null}
													{formatFileSize(event.bytes_completed)}
													{#if event.expected_size !== null}
														/ {formatFileSize(event.expected_size)}{/if}
												{/if}
												{#if event.progress_percent !== null}
													<span> ({event.progress_percent.toFixed(1)}%)</span>
												{/if}
											</span>
										</div>
										{#if event.progress_percent !== null}
											<div
												class="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-800"
												role="progressbar"
												aria-label="Postęp migracji pliku"
												aria-valuemin="0"
												aria-valuemax="100"
												aria-valuenow={event.progress_percent}
											>
												<div
													class="h-full rounded-full bg-primary transition-[width]"
													style:width={`${event.progress_percent}%`}
												></div>
											</div>
										{/if}
									</div>
								{/if}

								<div class="mt-4 flex flex-wrap gap-2 text-[11px] text-text-muted">
									{#if event.trigger}
										<span class="rounded-full border border-border-line bg-bg-panel px-2 py-1">
											Wyzwalacz: <strong class="font-medium text-text-main"
												>{triggerLabel(event.trigger)}</strong
											>
										</span>
									{/if}
									{#if event.origin && event.origin !== event.trigger}
										<span class="rounded-full border border-border-line bg-bg-panel px-2 py-1">
											Pochodzenie: <strong class="font-medium text-text-main"
												>{triggerLabel(event.origin)}</strong
											>
										</span>
									{/if}
									{#if event.attempt_count !== null}
										<span class="rounded-full border border-border-line bg-bg-panel px-2 py-1">
											Próba: <strong class="font-mono font-medium text-text-main"
												>{event.attempt_count}</strong
											>
										</span>
									{/if}
									{#if event.duration_ms !== null}
										<span class="rounded-full border border-border-line bg-bg-panel px-2 py-1">
											Czas: <strong class="font-mono font-medium text-text-main"
												>{formatDuration(event.duration_ms)}</strong
											>
										</span>
									{/if}
									{#if event.retry_at}
										<span
											class="rounded-full border border-amber-300/70 bg-amber-50 px-2 py-1 text-amber-800 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300"
										>
											Ponowienie: <time datetime={event.retry_at}
												>{formatTimestamp(event.retry_at)}</time
											>
										</span>
									{/if}
								</div>

								{#if event.error_message || event.error_code}
									<div
										class="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm dark:border-red-900 dark:bg-red-950/40"
									>
										<p class="font-medium text-red-800 dark:text-red-300">Błąd migracji</p>
										{#if event.error_message}
											<p class="mt-1 break-words text-red-700 dark:text-red-400">
												{event.error_message}
											</p>
										{/if}
										{#if event.error_code}
											<p class="mt-1 font-mono text-xs text-red-700 dark:text-red-400">
												Kod: {event.error_code}
											</p>
										{/if}
									</div>
								{/if}

								<details class="mt-4 border-t border-border-line pt-3 text-xs">
									<summary
										class="cursor-pointer font-medium text-text-muted hover:text-text-main focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
									>
										Identyfikatory i metadane
									</summary>
									<div class="mt-3 space-y-3">
										<dl class="grid gap-2">
											{#each correlationEntries(event) as entry (entry.label)}
												<div
													class="grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center"
												>
													<dt class="text-text-muted">{entry.label}</dt>
													<dd class="min-w-0">
														<code class="block select-all break-all text-text-main"
															>{entry.value}</code
														>
													</dd>
													<button
														type="button"
														class="inline-flex items-center gap-1 justify-self-start rounded px-1.5 py-1 text-text-muted hover:bg-gray-100 hover:text-text-main focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary dark:hover:bg-zinc-800"
														onclick={() => copyValue(entry.label, entry.value)}
														aria-label={`Skopiuj: ${entry.label}`}
													>
														<Copy class="h-3.5 w-3.5" />
														Kopiuj
													</button>
												</div>
											{/each}
										</dl>
										{#if hasMetadata(event)}
											<div>
												<p class="mb-1.5 font-medium text-text-muted">Surowe metadane</p>
												<pre
													class="max-h-72 overflow-auto rounded-md border border-border-line bg-bg-panel p-3 font-mono text-[11px] leading-relaxed text-text-main">{metadataJson(
														event.metadata
													)}</pre>
											</div>
										{/if}
									</div>
								</details>
							</article>
						</li>
					{/each}
				</ol>
			{:else}
				<p class="text-sm text-text-muted">Dziennik pojawi się po pierwszym uruchomieniu.</p>
			{/if}
		</Card>
	</div>

	{#if form && 'error' in form}
		<p class="text-sm text-red-600 dark:text-red-400">{form.error}</p>
	{/if}
</div>
