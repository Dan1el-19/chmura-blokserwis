import { expect, it, vi } from 'vitest';
import {
	capturePlayback,
	mediaKindForFilename,
	restorePlayback,
	type MediaPlaybackTarget
} from './media-preview.js';

it.each([
	['photo.JPG', 'IMAGE'],
	['image.jpeg', 'IMAGE'],
	['image.png', 'IMAGE'],
	['image.gif', 'IMAGE'],
	['image.webp', 'IMAGE'],
	['image.avif', 'IMAGE'],
	['sound.mp3', 'AUDIO'],
	['sound.wav', 'AUDIO'],
	['sound.ogg', 'AUDIO'],
	['sound.m4a', 'AUDIO'],
	['movie.mp4', 'VIDEO'],
	['movie.webm', 'VIDEO']
])('recognizes supported browser preview %s', (name, kind) => {
	expect(mediaKindForFilename(name)).toBe(kind);
});

it.each(['document.pdf', 'vector.svg', 'page.html', 'unknown', 'empty.'])(
	'rejects browser preview for %s',
	(name) => {
		expect(mediaKindForFilename(name)).toBeNull();
	}
);

it('restores the playhead and resumes only media that was already playing', async () => {
	let currentTime = 0;
	const play = vi.fn(async () => {});
	const playingMedia: MediaPlaybackTarget = {
		get currentTime() {
			return currentTime;
		},
		set currentTime(value: number) {
			currentTime = value;
		},
		paused: false,
		play
	};
	currentTime = 42;
	const snapshot = capturePlayback(playingMedia);
	currentTime = 0;
	await restorePlayback(playingMedia, snapshot);
	expect(currentTime).toBe(42);
	expect(play).toHaveBeenCalledOnce();

	const pausedMedia: MediaPlaybackTarget = {
		get currentTime() {
			return currentTime;
		},
		set currentTime(value: number) {
			currentTime = value;
		},
		paused: true,
		play
	};
	currentTime = 0;
	await restorePlayback(pausedMedia, { currentTime: 42, paused: true });
	expect(currentTime).toBe(42);
	expect(play).toHaveBeenCalledOnce();
});
