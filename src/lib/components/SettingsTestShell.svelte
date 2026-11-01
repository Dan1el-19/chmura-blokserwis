<script lang="ts">
	import { setContext } from 'svelte';
	import { CloudState, CLOUD_CONTEXT } from '../cloud-state.svelte.js';
	import StorageSettingsPage from './StorageSettingsPage.svelte';
	let { visible = true }: { visible?: boolean } = $props();
	const app = new CloudState();
	app.activate('test-user');
	setContext(CLOUD_CONTEXT, app);
</script>

{#if visible}<StorageSettingsPage />{/if}
