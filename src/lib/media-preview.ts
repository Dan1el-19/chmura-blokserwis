export type BrowserMediaKind = 'IMAGE' | 'AUDIO' | 'VIDEO';
export type PlaybackSnapshot = { currentTime: number; paused: boolean };
export type MediaPlaybackTarget = {
	currentTime: number;
	paused: boolean;
	play: () => Promise<void>;
};

const MEDIA_KIND_BY_EXTENSION: Readonly<Record<string, BrowserMediaKind>> = {
	jpg: 'IMAGE',
	jpeg: 'IMAGE',
	png: 'IMAGE',
	gif: 'IMAGE',
	webp: 'IMAGE',
	avif: 'IMAGE',
	mp3: 'AUDIO',
	wav: 'AUDIO',
	ogg: 'AUDIO',
	m4a: 'AUDIO',
	mp4: 'VIDEO',
	webm: 'VIDEO'
};

export function mediaKindForFilename(name: string): BrowserMediaKind | null {
	const dot = name.lastIndexOf('.');
	if (dot < 0) return null;
	return MEDIA_KIND_BY_EXTENSION[name.slice(dot + 1).toLowerCase()] ?? null;
}

export function capturePlayback(media: MediaPlaybackTarget | undefined): PlaybackSnapshot | undefined {
	if (!media) return;
	return { currentTime: media.currentTime, paused: media.paused };
}

export async function restorePlayback(
	media: MediaPlaybackTarget | undefined,
	playback: PlaybackSnapshot | undefined
): Promise<void> {
	if (!media || !playback) return;
	try {
		media.currentTime = playback.currentTime;
		if (!playback.paused) await media.play();
	} catch {
		// Browser policy can block playback restoration; controls remain available.
	}
}
