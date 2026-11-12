<script lang="ts">
	import { quotePreviewDocument } from './preview.js';

	let { html }: { html: string } = $props();
	let width = $state(0);
	let height = $state(0);
	let fit = $state(true);
	let zoom = $state(1);
	let openError = $state('');
	const documentWidth = 210 * 96 / 25.4 + 32;
	let scale = $derived(fit ? Math.min(1, (width || documentWidth) / documentWidth) : zoom);
	let previewDocument = $derived(quotePreviewDocument(html));
	function changeZoom(delta: number) {
		zoom = Math.max(0.25, Math.min(2, Math.round((scale + delta) * 100) / 100));
		fit = false;
	}
	function openPreview() {
		const popup = window.open('about:blank', '_blank');
		if (!popup) { openError = 'Przeglądarka zablokowała otwarcie podglądu.'; return; }
		popup.opener = null;
		popup.document.title = 'Podgląd wyceny';
		popup.document.body.style.margin = '0';
		const frame = popup.document.createElement('iframe');
		frame.title = 'Podgląd wyceny';
		frame.setAttribute('sandbox', '');
		frame.style.cssText = 'border:0;width:100%;height:100vh;display:block';
		frame.srcdoc = previewDocument;
		popup.document.body.appendChild(frame);
		openError = '';
	}
</script>

<div class="space-y-2">
	<div class="flex flex-wrap items-center gap-2 text-sm" aria-label="Powiększenie podglądu">
		<button type="button" class="min-h-10 rounded-md border border-border-line px-3" aria-pressed={fit} onclick={() => fit = true}>Dopasuj do szerokości</button>
		<button type="button" class="min-h-10 rounded-md border border-border-line px-3" aria-label="Pomniejsz podgląd" onclick={() => changeZoom(-0.1)}>−</button>
		<button type="button" class="min-h-10 rounded-md border border-border-line px-3" aria-pressed={!fit && zoom === 1} onclick={() => { zoom = 1; fit = false; }}>100%</button>
		<button type="button" class="min-h-10 rounded-md border border-border-line px-3" aria-label="Powiększ podgląd" onclick={() => changeZoom(0.1)}>+</button>
		<button type="button" class="min-h-10 rounded-md border border-border-line px-3" onclick={openPreview}>Otwórz podgląd</button>
	</div>
	{#if openError}<p role="status" class="text-sm text-text-muted">{openError}</p>{/if}
	<div
		class="preview-viewport"
		bind:clientWidth={width}
		bind:clientHeight={height}
	>
		<div class="preview-page" style:width="{documentWidth * scale}px">
			<iframe
				title="Podgląd wyceny"
				sandbox=""
				srcdoc={previewDocument}
				style:width="{documentWidth}px"
				style:height="{height / scale}px"
				style:transform="scale({scale})"
			></iframe>
		</div>
	</div>
	<p class="text-xs text-text-muted">A4 · {fit ? 'Dopasowano do szerokości' : 'Powiększenie'} ({Math.round(scale * 100)}%). Podgląd nie pokazuje podziałów stron ani stopek PDF.</p>
</div>

<style>
	.preview-viewport {
		position: relative;
		height: 70vh;
		min-height: 24rem;
		overflow: auto;
		border: 1px solid var(--color-border-line);
		border-radius: 0.5rem;
		background: #e5e7eb;
	}

	.preview-page {
		position: relative;
		height: 100%;
		margin: 0 auto;
	}

	iframe {
		position: absolute;
		top: 0;
		left: 0;
		display: block;
		border: 0;
		transform-origin: top left;
	}
</style>
