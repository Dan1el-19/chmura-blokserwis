<script lang="ts">
	import type { PageProps } from './$types';
	import QuoteWizard from '#lib/quotes/QuoteWizard.svelte';
	let { params }: PageProps = $props();
</script>

<QuoteWizard id={params.id} />
