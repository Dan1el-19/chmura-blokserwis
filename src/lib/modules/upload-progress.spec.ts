import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { UploadManager } from './upload.svelte';

describe('UploadManager progress state', () => {
	it('updates the tracked file state when upload code holds the original file reference', () => {
		expect.assertions(2);

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

	it('does not warn when progress updates use a raw upload reference', () => {
		expect.assertions(1);

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
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

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

		expect(warn).not.toHaveBeenCalledWith(
			expect.stringContaining('state_proxy_equality_mismatch')
		);
		warn.mockRestore();
	});

	it('does not compare tracked state proxies with raw upload references', () => {
		const source = readFileSync(
			fileURLToPath(new URL('./upload.svelte.ts', import.meta.url)),
			'utf8'
		);

		expect(source).not.toContain('trackedFile !== file');
	});

	it('updates the tracked file error when upload code holds the original file reference', async () => {
		expect.assertions(1);

		const manager = new UploadManager();
		const trackedFile = {
			id: 'file-1',
			name: 'small.txt',
			size: 10,
			type: 'text/plain',
			source: new File(['contents'], 'small.txt', { type: 'text/plain' }),
			destination: 'r2' as const,
			progress: { percentage: 25, uploadComplete: false },
			controller: new AbortController()
		};
		const originalReference = {
			...trackedFile,
			progress: { percentage: 25, uploadComplete: false }
		};

		manager.files = [trackedFile];
		await (
			manager as unknown as {
				markFailed: (
					file: {
						id: string;
						error?: string;
						progress: { percentage: number; uploadComplete: boolean };
					},
					error: Error
				) => Promise<void>;
			}
		).markFailed(originalReference, new Error('File not found in storage'));

		expect(manager.files[0].error).toBe('File not found in storage');
	});

	it('uses the configured default destination when file picker adds a file without an explicit destination', () => {
		expect.assertions(1);

		const manager = new UploadManager({
			destination: () => 'appwrite',
			recommendedDestination: () => 'r2'
		});
		(manager as unknown as { uploadFile: () => Promise<void> }).uploadFile = async () => undefined;

		manager.addFile(new File(['contents'], 'small.txt', { type: 'text/plain' }));

		expect(manager.files[0].destination).toBe('appwrite');
	});

	it('resolves auto uploads in hybrid mode to Appwrite for small files', () => {
		expect.assertions(1);

		const manager = new UploadManager({
			destination: () => 'auto',
			recommendedDestination: () => 'hybrid'
		});
		(manager as unknown as { uploadFile: () => Promise<void> }).uploadFile = async () => undefined;

		manager.addFile(new File(['contents'], 'small.txt', { type: 'text/plain' }));

		expect(manager.files[0].destination).toBe('appwrite');
	});
});
