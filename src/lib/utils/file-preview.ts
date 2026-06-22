export type MediaKind = 'image' | 'audio' | 'video' | 'unsupported';
export type StorageKind = 'user' | 'main';

export interface PreviewEndpointInput {
	fileId: string;
	storageKind: StorageKind;
	targetUserId?: string | null;
}

export interface PreviewableFile {
	name: string;
	mimeType?: string | null;
	thumbnailUrl?: string | null;
}

export interface FilePreviewResponse {
	previewUrl: string;
	downloadUrl: string;
	expiresAt: number;
	contentType: string;
	thumbnailUrl?: string | null;
}

export interface FilePreviewTarget {
	id: string;
	name: string;
	mimeType: string;
	size: number;
}

export function getMediaKind(mimeType: string | null | undefined): MediaKind {
	const value = (mimeType ?? '').toLowerCase();
	if (value.startsWith('image/')) return 'image';
	if (value.startsWith('audio/')) return 'audio';
	if (value.startsWith('video/')) return 'video';
	return 'unsupported';
}

export function canPreviewInline(mimeType: string | null | undefined): boolean {
	return getMediaKind(mimeType) !== 'unsupported';
}

export function getPreviewEndpoint(input: PreviewEndpointInput): string {
	const base =
		input.storageKind === 'main'
			? `/api/main/${encodeURIComponent(input.fileId)}/preview`
			: `/api/files/${encodeURIComponent(input.fileId)}/preview`;

	if (input.storageKind === 'main' || !input.targetUserId) return base;

	const params = new URLSearchParams({ targetUserId: input.targetUserId });
	return `${base}?${params.toString()}`;
}

export function getThumbnailLabel(file: PreviewableFile): string {
	const kind = getMediaKind(file.mimeType);
	if (kind === 'image') return 'Obraz';
	if (kind === 'audio') return 'Audio';
	if (kind === 'video') return 'Wideo';
	return 'Plik';
}
