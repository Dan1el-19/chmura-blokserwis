<script lang="ts">
	import StoragePage from '$lib/components/files/StoragePage.svelte';

	let { data } = $props();
</script>

<StoragePage {data} titleRoot="Main" rootHref="/main" />
