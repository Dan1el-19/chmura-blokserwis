<script lang="ts">
	import { setContext } from 'svelte';
	import { CloudState, CLOUD_CONTEXT } from '../cloud-state.svelte.js';
	import StoragePage from './StoragePage.svelte';
	import UploadPanel from './UploadPanel.svelte';
	let {
		spaceKind = 'private',
		mode = 'files',
		app = new CloudState(),
		visible = true
	}: {
		spaceKind?: 'private' | 'shared';
		mode?: 'files' | 'trash';
		app?: CloudState;
		visible?: boolean;
	} = $props();
	// The session provider is intentionally fixed for the lifetime of this shell.
	// svelte-ignore state_referenced_locally
	setContext(CLOUD_CONTEXT, app);
</script>

{#if visible}{#key `${spaceKind}:${mode}`}<StoragePage {spaceKind} {mode} />{/key}{/if}
<UploadPanel manager={app.transfers} />
