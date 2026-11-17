<script lang="ts">
	import { tick } from 'svelte';
	import type { PDFDocumentProxy, PDFDocumentLoadingTask } from 'pdfjs-dist';
	import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
	import QuotePdfPage from './QuotePdfPage.svelte';
	import { button } from './ui.js';

	let { bytes, onloaded, onerror }: { bytes: Uint8Array; onloaded?:()=>void; onerror?:()=>void } = $props();
	let focused = $state(false);
	let dialog = $state<HTMLDialogElement>();
	$effect(() => { if (focused && dialog && !dialog.open) dialog.showModal(); });
	let pdf = $state<PDFDocumentProxy>();
	let viewport = $state<HTMLDivElement>();
	let width = $state(0);
	let height = $state(0);
	let fitWidth = $state(false);
	let focusButton = $state<HTMLButtonElement>();
	let fit = $state(true);
	let zoom = $state(1);
	let error = $state('');
	const scale = $derived(fit ? Math.max(0.2, Math.min(2, (width - 32) / 595.276, fitWidth ? 2 : (height - 32) / 841.89)) : zoom);
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

{#snippet viewer()}
<div class="space-y-2">
	<div class="flex flex-wrap items-center gap-2 text-sm" aria-label="Powiększenie podglądu">
		<button type="button" class={button} aria-label="Dopasuj do szerokości" aria-pressed={fit} onclick={() => { fit = true; fitWidth = true; }}><span class="fit-full">Dopasuj do szerokości</span><span class="fit-short" aria-hidden="true">Dopasuj</span></button>
		<button type="button" class={button} aria-label="Pomniejsz podgląd" onclick={() => changeZoom(-.1)}>−</button>
		<button type="button" class={button} aria-pressed={!fit && zoom === 1} onclick={() => { zoom = 1; fit = false; }}>100%</button>
		<button type="button" class={button} aria-label="Powiększ podgląd" onclick={() => changeZoom(.1)}>+</button>
		<button type="button" class={button} bind:this={focusButton} aria-label={focused ? 'Zamknij powiększenie' : 'Powiększ dokument'} onclick={() => { if (focused) { dialog?.close(); focused = false; } else focused = true; }}>{focused ? 'Zamknij' : 'Powiększ dokument ↗'}</button>
	</div>
	{#if error}<p role="alert">{error}</p>{/if}
	<div class="pdf-viewport" class:focused bind:this={viewport} bind:clientWidth={width} bind:clientHeight={height}>
		{#if pdf && viewport}
			{#key scale}
			{#each Array.from({length:pdf.numPages}, (_, i) => i + 1) as pageNumber (pageNumber)}
				<QuotePdfPage {pdf} {pageNumber} {scale} root={viewport} onloaded={() => { if(pageNumber===1) onloaded?.(); }} {onerror} />
			{/each}
			{/key}
			{#if !focused}<button type="button" class="pdf-focus-surface" aria-label="Powiększ stronę PDF" onclick={() => focused = true}></button>{/if}
		{:else if !error}<p role="status">Wczytywanie PDF…</p>{/if}
	</div>
	{#if pdf}<p class="text-xs text-text-muted">Liczba stron: {pdf.numPages} · {Math.round(scale * 100)}%</p>{/if}
</div>
{/snippet}
{#if !focused}{@render viewer()}{/if}
<dialog bind:this={dialog} onclose={async () => { focused = false; await tick(); focusButton?.focus(); }} aria-labelledby="pdf-focus-title" class="pdf-dialog">
 {#if focused}<h2 id="pdf-focus-title" class="mb-3 font-semibold">Podgląd PDF</h2>{@render viewer()}{/if}
</dialog>
<style>
 .fit-short{display:none}@media(max-width:480px){.fit-full{display:none}.fit-short{display:inline}}
	.pdf-viewport { position:relative; height:calc(100dvh - 22rem); min-height:24rem; overflow:auto; padding:1rem; border:1px solid var(--color-border-line); border-radius:.5rem; background:#e5e7eb; }
 .pdf-focus-surface{position:absolute;inset:0;width:100%;min-height:100%;cursor:zoom-in;background:transparent;border:0}
 .pdf-focus-surface:focus-visible{outline:3px solid var(--color-primary);outline-offset:-4px}
 .pdf-dialog{width:min(96vw,84rem);max-width:none;max-height:96dvh;margin:auto;padding:1.25rem;border:1px solid var(--color-border-line);border-radius:1rem;background:var(--color-bg-panel);color:var(--color-text-main);box-shadow:0 2rem 6rem #0005}
 .pdf-dialog::backdrop{background:#10182880;backdrop-filter:blur(8px)}
 .pdf-viewport.focused{height:calc(94dvh - 10rem);min-height:12rem}
 @media(max-width:600px){.pdf-dialog{width:100vw;max-height:100dvh;border-radius:0;padding:.75rem}.pdf-viewport{height:65vh;min-height:20rem;padding:.5rem}.pdf-viewport.focused{height:calc(100dvh - 11rem)}}
</style>
