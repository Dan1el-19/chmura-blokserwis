<script lang="ts">
	import QuotationEditor from '$lib/components/quotations/QuotationEditor.svelte';
	let { data } = $props();
	let quotation = $derived(data.quotation.item);
</script>

{#if quotation}
	<QuotationEditor
		{quotation}
		letterheads={data.letterheads?.items ?? []}
		operations={data.operations?.items ?? []}
		versions={data.versions?.items ?? []}
	/>
{:else}
	<section
		class="mx-auto max-w-3xl rounded-md border border-red-200 bg-red-50 p-6 text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-200"
	>
		<h1 class="text-lg font-semibold">Nie udało się wczytać wyceny</h1>
		<p class="mt-2 text-sm">Wróć do listy i spróbuj ponownie.</p>
		<a href="/wyceny" class="mt-4 inline-flex text-sm font-medium text-primary hover:underline"
			>Wróć do wycen</a
		>
	</section>
{/if}
