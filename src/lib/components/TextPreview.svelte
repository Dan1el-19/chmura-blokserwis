<script lang="ts">
	import { readTextPreview } from '#lib/text-preview.js';
	let { url, sizeBytes }: { url: string; sizeBytes?: number } = $props();
	let text = $state('');
	let truncated = $state(false);
	let loading = $state(true);
	let error = $state('');
	let attempt = $state(0);
	$effect(() => {
		const currentUrl = url;
		void attempt;
		const controller = new AbortController();
		loading = true;
		text = '';
		truncated = false;
		error = '';
		if (sizeBytes === 0) { loading = false; return () => controller.abort(); }
		void readTextPreview(currentUrl, controller.signal).then((result) => {
			if (controller.signal.aborted) return;
			text = result.text;
			truncated = result.truncated;
		}).catch(() => {
			if (!controller.signal.aborted) error = 'Nie udało się odczytać podglądu tekstu.';
		}).finally(() => {
			if (!controller.signal.aborted) loading = false;
		});
		return () => controller.abort();
	});
</script>

{#if loading}<p role="status" class="text-sm text-text-muted">Ładowanie tekstu…</p>
{:else if error}<div role="alert" class="text-sm text-red-600">{error} <button type="button" class="underline" onclick={() => attempt++}>Spróbuj ponownie</button></div>
{:else}<pre class="max-h-[65dvh] overflow-auto rounded-md bg-bg-app p-4 font-mono text-sm whitespace-pre-wrap break-words">{text}</pre>{#if truncated}<p class="mt-2 text-sm text-text-muted">Podgląd skrócono do 1 MiB. Pobierz plik, aby zobaczyć całość.</p>{/if}{/if}
