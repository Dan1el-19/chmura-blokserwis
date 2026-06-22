import { describe, expect, it } from 'vitest';
import {
	getMediaKind,
	canPreviewInline,
	getPreviewEndpoint,
	getThumbnailLabel
} from './file-preview';

describe('file preview helpers', () => {
	it.each([
		['image/png', 'image'],
		['image/jpeg', 'image'],
		['audio/mpeg', 'audio'],
		['video/mp4', 'video'],
		['application/pdf', 'unsupported'],
		['', 'unsupported']
	])('maps %s to %s', (mimeType, expected) => {
		expect(getMediaKind(mimeType)).toBe(expected);
	});

	it('allows only image audio and video for inline preview', () => {
		expect(canPreviewInline('image/webp')).toBe(true);
		expect(canPreviewInline('audio/ogg')).toBe(true);
		expect(canPreviewInline('video/webm')).toBe(true);
		expect(canPreviewInline('application/zip')).toBe(false);
	});

	it('builds a user storage preview endpoint with target user passthrough', () => {
		expect(
			getPreviewEndpoint({ fileId: 'file-1', storageKind: 'user', targetUserId: 'user-2' })
		).toBe('/api/files/file-1/preview?targetUserId=user-2');
	});

	it('builds a main storage preview endpoint separately from user files', () => {
		expect(getPreviewEndpoint({ fileId: 'main-1', storageKind: 'main' })).toBe(
			'/api/main/main-1/preview'
		);
	});

	it('returns human labels for thumbnails', () => {
		expect(getThumbnailLabel({ name: 'photo.png', mimeType: 'image/png' })).toBe('Obraz');
		expect(getThumbnailLabel({ name: 'song.mp3', mimeType: 'audio/mpeg' })).toBe('Audio');
		expect(getThumbnailLabel({ name: 'movie.mp4', mimeType: 'video/mp4' })).toBe('Wideo');
		expect(getThumbnailLabel({ name: 'archive.zip', mimeType: 'application/zip' })).toBe('Plik');
	});
});
