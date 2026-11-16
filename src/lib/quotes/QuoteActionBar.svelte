<script lang="ts">
	let { saveState, disabled, approveLabel, onsave, onapprove, height = $bindable(0) }: {
		saveState: 'clean' | 'dirty' | 'saving' | 'error';
		disabled: boolean;
		approveLabel: string;
		onsave: () => void;
		onapprove: () => void;
		height?: number;
	} = $props();
</script>

<section bind:offsetHeight={height} aria-label="Zapis wyceny" class="quote-action-bar sticky z-10 rounded-lg border border-border-line bg-bg-panel p-2 shadow-lg" style:bottom="var(--transfer-offset, 0px)">
	<p role="status" aria-live="polite" class="mb-1 text-xs text-text-muted">{saveState === 'saving' ? 'Zapisywanie…' : saveState === 'error' ? 'Nie udało się zapisać' : saveState === 'dirty' ? 'Niezapisane zmiany' : 'Zapisano'}</p>
	<div class="flex flex-wrap gap-2">
		<button type="button" class="min-h-11 flex-1 rounded-md border border-border-line px-3 text-sm font-medium disabled:opacity-50" {disabled} onclick={onsave}>{saveState === 'error' ? 'Ponów zapis' : 'Zapisz szkic'}</button>
		<button type="button" class="min-h-11 flex-1 rounded-md bg-primary px-3 text-sm font-medium text-white disabled:opacity-50" {disabled} onclick={onapprove}>{approveLabel}</button>
	</div>
</section>

<style>
	@container quote-editor (min-width: 1084px) { .quote-action-bar { display: none; } }
</style>
