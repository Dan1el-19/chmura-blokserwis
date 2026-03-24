import Uppy from '@uppy/core';
import AwsS3 from '@uppy/aws-s3';

const MB = 1024 * 1024;
const MIN_CHUNK_SIZE = 25 * MB;
const MAX_CHUNK_SIZE = 500 * MB;
const MAX_PARTS = 8000;
const MULTIPART_THRESHOLD = 50 * MB;
const CONCURRENT_PARTS = 10;

function getChunkSize(file: { size: number }): number {
	const fileSize = file.size ?? 0;
	const safetySize = Math.ceil(fileSize / MAX_PARTS);
	let tieredSize: number;
	if (fileSize > 5 * 1024 * MB) tieredSize = 100 * MB;
	else if (fileSize > 1024 * MB) tieredSize = 50 * MB;
	else if (fileSize > 500 * MB) tieredSize = 32 * MB;
	else tieredSize = MIN_CHUNK_SIZE;
	return Math.min(MAX_CHUNK_SIZE, Math.max(MIN_CHUNK_SIZE, Math.max(safetySize, tieredSize)));
}

export type ReleaseUploadResult = {
	key: string;
	name: string;
	size: number;
};

export type ReleaseUploadOptions = {
	filename: string;
	overwrite: boolean;
	onProgress?: (progress: number) => void;
	onComplete?: (result: ReleaseUploadResult) => void;
	onError?: (error: Error) => void;
};

export class ReleaseUploader {
	private uppy: Uppy;
	private options: ReleaseUploadOptions;

	progress = $state(0);
	isUploading = $state(false);
	error = $state<string | null>(null);

	constructor(options: ReleaseUploadOptions) {
		this.options = options;

		this.uppy = new Uppy({
			restrictions: {
				maxNumberOfFiles: 1,
				allowedFileTypes: ['.apk', 'application/vnd.android.package-archive']
			},
			autoProceed: true
		});

		if (typeof window !== 'undefined') {
			const self = this;
			this.uppy.use(AwsS3, {
				shouldUseMultipart: (file) => (file.size ?? 0) > MULTIPART_THRESHOLD,
				getChunkSize,
				limit: CONCURRENT_PARTS,
				async getUploadParameters(file) {
					const res = await fetch('/api/releases/sign', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							filename: self.options.filename,
							type: file.type || 'application/vnd.android.package-archive',
							overwrite: self.options.overwrite
						})
					});
					if (!res.ok) {
						const err = await res.json();
						throw new Error(err.message || 'Failed to get upload parameters');
					}
					const json = await res.json();
					file.meta['r2Key'] = json.key;
					return json;
				},
				async createMultipartUpload(file) {
					const res = await fetch('/api/releases/multipart', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							filename: self.options.filename,
							type: file.type || 'application/vnd.android.package-archive',
							overwrite: self.options.overwrite
						})
					});
					if (!res.ok) {
						const err = await res.json();
						throw new Error(err.message || 'Failed to create multipart upload');
					}
					const json = await res.json();
					file.meta['r2Key'] = json.key;
					return json;
				},
				async listParts(file, { uploadId, key }) {
					const res = await fetch(
						`/api/releases/multipart/${uploadId}?key=${encodeURIComponent(key)}`
					);
					if (!res.ok) throw new Error('Failed to list parts');
					return res.json();
				},
				async signPart(file, { uploadId, key, partNumber }) {
					const res = await fetch(
						`/api/releases/multipart/${uploadId}/${partNumber}?key=${encodeURIComponent(key)}`
					);
					if (!res.ok) throw new Error('Failed to sign part');
					return res.json();
				},
				async abortMultipartUpload(file, { uploadId, key }) {
					await fetch(`/api/releases/multipart/${uploadId}?key=${encodeURIComponent(key)}`, {
						method: 'DELETE'
					});
				},
				async completeMultipartUpload(file, { uploadId, key, parts }) {
					const res = await fetch(
						`/api/releases/multipart/${uploadId}/complete?key=${encodeURIComponent(key)}`,
						{
							method: 'POST',
							headers: { 'Content-Type': 'application/json' },
							body: JSON.stringify({ parts })
						}
					);
					if (!res.ok) throw new Error('Failed to complete multipart upload');
					return res.json();
				}
			});

			this.uppy.on('upload', () => {
				this.isUploading = true;
				this.error = null;
			});

			this.uppy.on('upload-progress', () => {
				this.progress = this.uppy.getState().totalProgress;
				options.onProgress?.(this.progress);
			});

			this.uppy.on('complete', (result) => {
				this.isUploading = false;
				this.progress = 100;

				if (result.successful && result.successful.length > 0) {
					const file = result.successful[0];
					options.onComplete?.({
						key: (file.meta['r2Key'] as string) || '',
						name: this.options.filename,
						size: file.size ?? 0
					});
				}
			});

			this.uppy.on('error', (err) => {
				this.isUploading = false;
				this.error = err.message;
				options.onError?.(err);
			});
		}
	}

	upload(file: File) {
		this.uppy.addFile({
			name: this.options.filename,
			type: file.type || 'application/vnd.android.package-archive',
			data: file
		});
	}

	cancel() {
		this.uppy.cancelAll();
		this.isUploading = false;
	}

	destroy() {
		this.uppy.destroy();
	}
}
