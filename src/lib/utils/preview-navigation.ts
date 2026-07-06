import { pushState, replaceState } from '$app/navigation';

export type PreviewOpenSource = 'user' | 'history';

export function openPreviewHistory(fileId: string, source: PreviewOpenSource) {
	if (source === 'history') return;
	pushState('', { previewFileId: fileId });
}

export function closePreviewHistory() {
	replaceState('', {});
}
