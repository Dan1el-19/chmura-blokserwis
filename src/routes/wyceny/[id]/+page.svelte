<script lang="ts">
	import type { PageProps } from './$types';
	import QuoteEditor from '#lib/quotes/QuoteEditor.svelte';
	let { params }: PageProps = $props();
</script>

{#key params.id}
	<QuoteEditor id={params.id} />
{/key}
