<script lang="ts">
	import { canPreviewInline } from '$lib/utils/file-preview';
	import FilePreviewDialog from '$lib/components/files/FilePreviewDialog.svelte';

	let {
		fileName,
		mimeType,
		previewUrl,
		downloadUrl,
		fileSize = 0
	}: {
		fileName: string;
		mimeType: string;
		previewUrl: string | null;
		downloadUrl: string | null;
		fileSize?: number | null;
	} = $props();

	const resolvedPreviewUrl = $derived(previewUrl ?? downloadUrl);
	const showPreview = $derived(Boolean(resolvedPreviewUrl && canPreviewInline(mimeType)));
	const preview = $derived(
		resolvedPreviewUrl
			? {
					previewUrl: resolvedPreviewUrl,
					downloadUrl: downloadUrl ?? resolvedPreviewUrl,
					expiresAt: 0,
					contentType: mimeType,
					thumbnailUrl: null
				}
			: null
	);
	let previewOpen = $state(true);
</script>

<FilePreviewDialog
	open={previewOpen && showPreview}
	file={{
		id: 'public-share',
		name: fileName,
		mimeType,
		size: fileSize ?? 0
	}}
	{preview}
	loading={false}
	error={null}
	onClose={() => (previewOpen = false)}
	onRetry={() => (previewOpen = true)}
/>
