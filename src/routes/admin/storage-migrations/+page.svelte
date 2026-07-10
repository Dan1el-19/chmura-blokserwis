<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowsClockwise, CheckCircle, Clock, Database, WarningCircle } from 'phosphor-svelte';
	import { toast } from 'svelte-sonner';
	import Card from '$lib/components/ui/Card.svelte';
	import Button from '$lib/components/ui/Button.svelte';
	import { formatFileSize } from '$lib/utils/format';

	let { data, form } = $props();
	let isSubmitting = $state(false);

	const dashboard = $derived(data.dashboard);
	const activeRun = $derived(dashboard.active_run);
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
					<p class="mt-1 font-mono text-text-main">{formatFileSize(activeRun.bytes_transferred)}</p>
				</div>
			</div>
		{:else}
			<p class="text-sm text-text-muted">
				Brak aktywnej migracji. Harmonogram nocny uruchomi kolejkę po przekroczeniu progu.
			</p>
		{/if}
	</Card>

	<div class="grid gap-6 xl:grid-cols-2">
		<Card title="Ostatnie uruchomienia">
			{#if dashboard.recent_runs.length}
				<div class="divide-y divide-border-line text-sm">
					{#each dashboard.recent_runs as run (run.id)}
						<div class="flex items-center justify-between gap-4 py-3">
							<div>
								<p class="font-medium text-text-main">{statusLabel(run.status)}</p>
								<p class="text-xs text-text-muted">
									{run.dry_run
										? 'Próba na sucho'
										: `${run.files_completed}/${run.files_total} plików`}
								</p>
							</div>
							<p class="font-mono text-xs text-text-muted">
								{formatFileSize(run.bytes_transferred)}
							</p>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-text-muted">Nie ma jeszcze zapisanych uruchomień.</p>
			{/if}
		</Card>

		<Card title="Dziennik">
			{#if dashboard.recent_events.length}
				<div class="divide-y divide-border-line text-sm">
					{#each dashboard.recent_events as event (event.id)}
						<div class="flex gap-3 py-3">
							{#if event.level === 'error'}
								<WarningCircle class="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
							{:else if event.level === 'warning'}
								<Clock class="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
							{:else}
								<CheckCircle class="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
							{/if}
							<div class="min-w-0">
								<p class="text-text-main">{event.message}</p>
								{#if event.file_name}<p class="truncate font-mono text-xs text-text-muted">
										{event.file_name}
									</p>{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				<p class="text-sm text-text-muted">Dziennik pojawi się po pierwszym uruchomieniu.</p>
			{/if}
		</Card>
	</div>

	{#if form && 'error' in form}
		<p class="text-sm text-red-600 dark:text-red-400">{form.error}</p>
	{/if}
</div>
