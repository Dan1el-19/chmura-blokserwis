<script lang="ts">
	import type { UppyState } from '$lib/modules/upload.svelte';
	import DropZone from '$lib/components/upload/DropZone.svelte';
	import UploadProgressList from '$lib/components/upload/UploadProgressList.svelte';
	import MobileStartUploadFAB from '$lib/components/upload/MobileStartUploadFAB.svelte';

	let { uppyState, onMobileUpload, onMobileNewFolder } = $props<{
		uppyState: UppyState;
		onMobileUpload?: (destination: 'r2' | 'appwrite' | 'auto') => void;
		onMobileNewFolder?: () => void;
	}>();

	function onFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files) {
			Array.from(input.files).forEach((file) => uppyState.addFile(file));
			input.value = '';
		}
	}

	function openFilePicker() {
		document.getElementById('file-input')?.click();
	}

	function handleMobileUpload() {
		if (onMobileUpload) {
			onMobileUpload('auto');
			return;
		}

		openFilePicker();
	}
</script>

<input type="file" multiple class="hidden" id="file-input" onchange={onFileSelect} />

<div class="space-y-4">
	<DropZone {openFilePicker} />
	<UploadProgressList {uppyState} />
</div>

<MobileStartUploadFAB onUpload={handleMobileUpload} onNewFolder={onMobileNewFolder} />
