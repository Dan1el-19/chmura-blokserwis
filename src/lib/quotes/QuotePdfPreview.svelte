<script lang="ts">
	import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist';
	import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
	import QuotePdfPage from './QuotePdfPage.svelte';
	import { button } from './ui.js';

	let { bytes, onloaded, onerror }: { bytes: Uint8Array; onloaded?:()=>void; onerror?:()=>void } = $props();
	let pdf = $state<PDFDocumentProxy>();
	let viewport = $state<HTMLDivElement>();
	let width = $state(0);
	let fit = $state(true);
	let zoom = $state(1);
	let error = $state('');
	const scale = $derived(fit ? Math.max(0.2, Math.min(2, (width - 32) / 595.276)) : zoom);
	function changeZoom(delta: number) { zoom = Math.max(.25, Math.min(2, Math.round((scale + delta) * 100) / 100)); fit = false; }
	$effect(() => {
		const input = bytes;
		let cancelled = false;
		let task: PDFDocumentLoadingTask | undefined;
		pdf = undefined; error = '';
		void (async () => {
			try {
				const pdfjs = await import('pdfjs-dist');
				if (cancelled) return;
				pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
				task = pdfjs.getDocument({ data: input.slice() });
				const doc = await task.promise;
				if (!cancelled) pdf = doc;
			} catch { if (!cancelled) { error = 'Nie udało się otworzyć pliku PDF.'; onerror?.(); } }
		})();
		return () => { cancelled = true; if (task) void task.destroy(); };
	});
</script>

<div class="space-y-2">
	<div class="flex flex-wrap items-center gap-2 text-sm" aria-label="Powiększenie podglądu">
		<button type="button" class={button} aria-label="Dopasuj do szerokości" aria-pressed={fit} onclick={() => fit = true}><span class="fit-full">Dopasuj do szerokości</span><span class="fit-short" aria-hidden="true">Dopasuj</span></button>
		<button type="button" class={button} aria-label="Pomniejsz podgląd" onclick={() => changeZoom(-.1)}>−</button>
		<button type="button" class={button} aria-pressed={!fit && zoom === 1} onclick={() => { zoom = 1; fit = false; }}>100%</button>
		<button type="button" class={button} aria-label="Powiększ podgląd" onclick={() => changeZoom(.1)}>+</button>
	</div>
	{#if error}<p role="alert">{error}</p>{/if}
	<div class="pdf-viewport" bind:this={viewport} bind:clientWidth={width}>
		{#if pdf && viewport}
			{#key scale}
			{#each Array.from({length:pdf.numPages}, (_, i) => i + 1) as pageNumber (pageNumber)}
				<QuotePdfPage {pdf} {pageNumber} {scale} root={viewport} onloaded={() => { if(pageNumber===1) onloaded?.(); }} {onerror} />
			{/each}
			{/key}
		{:else if !error}<p role="status">Wczytywanie PDF…</p>{/if}
	</div>
	{#if pdf}<p class="text-xs text-text-muted">Liczba stron: {pdf.numPages} · {Math.round(scale * 100)}%</p>{/if}
</div>
<style>
 .fit-short{display:none}@media(max-width:480px){.fit-full{display:none}.fit-short{display:inline}}
	.pdf-viewport { height:70vh; min-height:24rem; overflow:auto; padding:1rem; border:1px solid var(--color-border-line); border-radius:.5rem; background:#e5e7eb; }
</style>
