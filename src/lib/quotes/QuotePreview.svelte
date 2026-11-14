<script lang="ts">
	import { quotePreviewDocument } from './preview.js';

	let { html }: { html: string } = $props();
	let width = $state(0);
	let height = $state(0);
	const documentWidth = 210 * 96 / 25.4 + 32;
	let scale = $derived(Math.min(1, (width || documentWidth) / documentWidth));
	let document = $derived(quotePreviewDocument(html));
</script>

<div class="space-y-2">
	<div
		class="preview-viewport"
		bind:clientWidth={width}
		bind:clientHeight={height}
	>
		<iframe
			title="Podgląd wyceny"
			sandbox=""
			srcdoc={document}
			style:width="{documentWidth}px"
			style:height="{height / scale}px"
			style:transform="translateX(-50%) scale({scale})"
		></iframe>
	</div>
	<p class="text-xs text-text-muted">A4 · Dopasowano do szerokości ({Math.round(scale * 100)}%)</p>
</div>

<style>
	.preview-viewport {
		position: relative;
		height: 70vh;
		min-height: 24rem;
		overflow: hidden;
		border: 1px solid var(--color-border-line);
		border-radius: 0.5rem;
		background: #e5e7eb;
	}

	iframe {
		position: absolute;
		top: 0;
		left: 50%;
		display: block;
		border: 0;
		transform-origin: top center;
	}
</style>
