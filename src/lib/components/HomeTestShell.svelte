<script lang="ts">
	import { setContext } from 'svelte';
	import { CloudState, CLOUD_CONTEXT } from '../cloud-state.svelte.js';
	import HomePage from '../../routes/+page.svelte';
	setContext(CLOUD_CONTEXT, new CloudState());
</script>

<HomePage />
