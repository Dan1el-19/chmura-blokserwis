<script lang="ts">
	type Props = { quotationId: string; revision: number; title: string };
	let { quotationId, revision, title }: Props = $props();
	let src = $derived(
		`/api/quotations/${encodeURIComponent(quotationId)}/preview?revision=${revision}`
	);
	let reloadKey = $state(0);
	let frameKey = $derived(`${src}:${reloadKey}`);
	let loadedFrameKey = $state('');
	let failedFrameKey = $state('');
	let previewState = $derived<'loading' | 'ready' | 'error'>(
		failedFrameKey === frameKey ? 'error' : loadedFrameKey === frameKey ? 'ready' : 'loading'
	);

	function retry() {
		reloadKey += 1;
	}
</script>

<section class="overflow-hidden rounded-md border border-border-line bg-bg-panel">
	<div class="flex items-center justify-between border-b border-border-line px-4 py-3">
		<div>
			<h2 class="text-sm font-semibold text-text-main">Podgląd dokumentu</h2>
			<p class="mt-0.5 text-xs text-text-muted">Odświeża się po zapisie zmian.</p>
		</div>
		<a
			href={src}
			target="_blank"
			rel="noreferrer"
			class="text-xs font-medium text-primary hover:underline">Otwórz osobno</a
		>
	</div>
	<div class="relative">
		{#key frameKey}
			<iframe
				{src}
				sandbox="allow-scripts"
				title="Podgląd wyceny: {title}"
				class="h-[70vh] min-h-160 w-full bg-white"
				onload={() => {
					loadedFrameKey = frameKey;
					failedFrameKey = '';
				}}
				onerror={() => (failedFrameKey = frameKey)}
			></iframe>
		{/key}
		{#if previewState === 'loading'}
			<div
				class="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/85 text-sm text-text-muted"
				aria-live="polite"
			>
				Ładowanie podglądu…
			</div>
		{:else if previewState === 'error'}
			<div
				class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white p-4 text-center"
			>
				<p class="text-sm text-text-muted">Nie udało się załadować podglądu dokumentu.</p>
				<button
					type="button"
					class="rounded-md border border-border-line px-3 py-2 text-sm font-medium text-text-main hover:bg-bg-app"
					onclick={retry}>Spróbuj ponownie</button
				>
			</div>
		{/if}
	</div>
</section>
