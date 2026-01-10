<script lang="ts">
	import type { UppyState } from '$lib/modules/upload.svelte';
	import DropZone from '$lib/components/upload/DropZone.svelte';
	import UploadProgressList from '$lib/components/upload/UploadProgressList.svelte';
	import MobileStartUploadFAB from '$lib/components/upload/MobileStartUploadFAB.svelte';

	let { uppyState, onNewFolder } = $props<{ uppyState: UppyState; onNewFolder?: () => void }>();

	function onFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			Array.from(input.files).forEach((file) => {
				uppyState.addFile(file);
			});
			input.value = '';
		}
	}

	function openFilePicker() {
		document.getElementById('file-input')?.click();
	}
</script>

<input type="file" multiple class="hidden" id="file-input" onchange={onFileSelect} />

<div class="space-y-4">
	<!-- Drop Zone - Desktop only -->
	<DropZone {uppyState} {openFilePicker} />

	<!-- File List & Progress -->
	<UploadProgressList {uppyState} />
</div>

<!-- FAB Menu - Mobile only -->
<MobileStartUploadFAB {onNewFolder} {openFilePicker} />
