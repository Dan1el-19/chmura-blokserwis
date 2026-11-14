export type BrowserMediaKind = 'IMAGE' | 'AUDIO' | 'VIDEO' | 'PDF' | 'TEXT';
export type PlaybackSnapshot = { currentTime: number; paused: boolean };
export type MediaPlaybackTarget = {
	currentTime: number;
	paused: boolean;
	play: () => Promise<void>;
};

const MEDIA_KIND_BY_EXTENSION: Readonly<Record<string, BrowserMediaKind>> = {
	pdf: 'PDF',
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

const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'tsv', 'log', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'js', 'mjs', 'cjs', 'ts', 'tsx', 'jsx', 'py', 'rs', 'go', 'java', 'kt', 'c', 'h', 'cpp', 'hpp', 'css', 'sh', 'sql']);

export function mediaKindForFilename(name: string): BrowserMediaKind | null {
	const dot = name.lastIndexOf('.');
	if (dot < 0) return null;
	const extension = name.slice(dot + 1).toLowerCase();
	return TEXT_EXTENSIONS.has(extension) ? 'TEXT' : MEDIA_KIND_BY_EXTENSION[extension] ?? null;
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
