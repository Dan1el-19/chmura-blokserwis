import { describe, expect, it } from 'vitest';
import { UploadManager } from './upload.svelte';

describe('UploadManager progress state', () => {
	it('updates the tracked file state when upload code holds the original file reference', () => {
		const manager = new UploadManager();
		const trackedFile = {
			id: 'file-1',
			name: 'small.txt',
			size: 10,
			type: 'text/plain',
			source: new File(['contents'], 'small.txt', { type: 'text/plain' }),
			destination: 'r2' as const,
			progress: { percentage: 0, uploadComplete: false },
			controller: new AbortController()
		};
		const originalReference = {
			...trackedFile,
			progress: { percentage: 0, uploadComplete: false }
		};

		manager.files = [trackedFile];
		(
			manager as unknown as {
				updateProgress: (
					file: {
						id: string;
						progress: { percentage: number; uploadComplete: boolean };
					},
					percentage: number,
					uploadComplete?: boolean
				) => void;
			}
		).updateProgress(originalReference, 65);

		expect(manager.files[0].progress).toEqual({ percentage: 65, uploadComplete: false });
		expect(manager.totalProgress).toBe(65);
	});
});
