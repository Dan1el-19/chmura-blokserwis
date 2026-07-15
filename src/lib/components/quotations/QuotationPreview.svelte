<script lang="ts">
	type Props = { quotationId: string; revision: number; title: string };
	let { quotationId, revision, title }: Props = $props();
	let src = $derived(
		`/api/quotations/${encodeURIComponent(quotationId)}/preview?revision=${revision}`
	);
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
	<iframe
		{src}
		sandbox="allow-scripts"
		title="Podgląd wyceny: {title}"
		class="h-[70vh] min-h-160 w-full bg-white"
	></iframe>
</section>
