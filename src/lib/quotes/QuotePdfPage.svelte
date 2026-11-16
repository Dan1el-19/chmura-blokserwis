<script lang="ts">
	import type { PDFDocumentProxy, RenderTask, TextLayer } from 'pdfjs-dist';
	let { pdf, pageNumber, scale, root }: { pdf: PDFDocumentProxy; pageNumber: number; scale: number; root: HTMLElement } = $props();
	let container: HTMLDivElement;
	let canvas: HTMLCanvasElement;
	let textLayer: HTMLDivElement;
	let visible = $state(false);
	let error = $state('');
	function clearTextLayer() {
		// PDF.js owns this otherwise-empty node.
		// eslint-disable-next-line svelte/no-dom-manipulating
		textLayer.replaceChildren();
	}

	$effect(() => {
		const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { root, rootMargin: '100% 0px' });
		observer.observe(container);
		return () => observer.disconnect();
	});
	$effect(() => {
		const show = visible, factor = scale, doc = pdf, number = pageNumber;
		if (!show) { if (canvas) { canvas.width = 0; canvas.height = 0; } if (textLayer) clearTextLayer(); return; }
		let cancelled = false;
		let renderTask: RenderTask | undefined;
		let textTask: TextLayer | undefined;
		void (async () => {
			try {
				const [page, pdfjs] = await Promise.all([doc.getPage(number), import('pdfjs-dist')]);
				if (cancelled) return;
				const viewport = page.getViewport({ scale: factor });
				const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
				canvas.width = Math.ceil(viewport.width * pixelRatio);
				canvas.height = Math.ceil(viewport.height * pixelRatio);
				canvas.style.width = `${viewport.width}px`; canvas.style.height = `${viewport.height}px`;
				clearTextLayer();
				textLayer.style.setProperty('--total-scale-factor', String(viewport.scale));
				renderTask = page.render({ canvas, viewport, transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0] });
				textTask = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: textLayer, viewport });
				await Promise.all([renderTask.promise, textTask.render()]);
				if (!cancelled) error = '';
			} catch (reason) { if (!cancelled) error = reason instanceof Error ? reason.message : 'Nie udało się wyświetlić strony.'; }
		})();
		return () => { cancelled = true; renderTask?.cancel(); textTask?.cancel(); if (canvas) { canvas.width = 0; canvas.height = 0; } if (textLayer) clearTextLayer(); };
	});
</script>

<div bind:this={container} class="pdf-page" style:width="{595.276 * scale}px" style:min-height="{841.89 * scale}px" aria-label={`Strona ${pageNumber}`}>
	<canvas bind:this={canvas}></canvas>
	<div bind:this={textLayer} class="textLayer"></div>
	{#if error}<p role="status">Nie udało się wyświetlić strony {pageNumber}.</p>{/if}
</div>

<style>
	.pdf-page { position: relative; margin: 0 auto 1rem; background: white; box-shadow: 0 1px 5px #0003; }
	canvas { display: block; }
	.textLayer { position: absolute; inset: 0; overflow: clip; line-height: 1; text-align: initial; transform-origin: 0 0; --min-font-size: 1; --text-scale-factor: calc(var(--total-scale-factor) * var(--min-font-size)); --min-font-size-inv: calc(1 / var(--min-font-size)); }
	.textLayer :global(span), .textLayer :global(br) { position: absolute; color: transparent; white-space: pre; cursor: text; transform-origin: 0 0; user-select: text; }
	.textLayer :global(span:not(.markedContent)) { --font-height: 0; font-size: calc(var(--text-scale-factor) * var(--font-height)); --scale-x: 1; --rotate: 0deg; transform: rotate(var(--rotate)) scaleX(var(--scale-x)) scale(var(--min-font-size-inv)); }
	.textLayer :global(.markedContent) { display: contents; }
	.textLayer :global(::selection) { background: #0066cc55; }
</style>
