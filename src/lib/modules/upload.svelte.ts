import Uppy from '@uppy/core';
import AwsS3 from '@uppy/aws-s3';
import GoldenRetriever from '@uppy/golden-retriever';

const MB = 1024 * 1024;
const GB = 1024 * MB;
const MIN_CHUNK_SIZE = 25 * MB;
const MAX_CHUNK_SIZE = 500 * MB;
const MAX_PARTS = 8000;
const MULTIPART_THRESHOLD = 50 * MB;
const CONCURRENT_PARTS = 10;

function getNetworkMultiplier(): number {
	if (typeof navigator === 'undefined' || !('connection' in navigator)) {
		return 1;
	}
	const conn = navigator.connection as any;
	const downlink = conn?.downlink || 10;
	const effectiveType = conn?.effectiveType || '4g';
	if (downlink > 50 || effectiveType === '4g') return 1.5;
	if (downlink < 5 || effectiveType === '3g' || effectiveType === '2g') return 0.5;
	return 1;
}

function getChunkSize(file: { size: number }): number {
	const fileSize = file.size ?? 0;
	const safetySize = Math.ceil(fileSize / MAX_PARTS);
	let tieredSize: number;
	if (fileSize > 50 * GB) tieredSize = 100 * MB;
	else if (fileSize > 5 * GB) tieredSize = 50 * MB;
	else if (fileSize > 1 * GB) tieredSize = 32 * MB;
	else if (fileSize > 500 * MB) tieredSize = 28 * MB;
	else tieredSize = MIN_CHUNK_SIZE;
	const optimalSize = Math.max(safetySize, Math.round(tieredSize * getNetworkMultiplier()));
	return Math.min(MAX_CHUNK_SIZE, Math.max(MIN_CHUNK_SIZE, optimalSize));
}

export type UploadResult = {
	key: string;
	location?: string;
	name: string;
	size: number;
	type: string;
};

export class UppyState {
	uppy: Uppy;
	files = $state<any[]>([]);
	totalProgress = $state(0);
	isUploading = $state(false);

	constructor(
		options: {
			maxFileSize?: number | null;
			allowedFileTypes?: string[];
			onComplete?: (results: UploadResult[]) => void;
			onError?: (error: Error) => void;
		} = {}
	) {
		this.uppy = new Uppy({
			restrictions: {
				maxFileSize: options.maxFileSize,
				allowedFileTypes: options.allowedFileTypes
			},
			autoProceed: true
		});

		if (typeof window !== 'undefined') {
			this.uppy.use(GoldenRetriever, { expires: 24 * 60 * 60 * 1000 }).use(AwsS3, {
				shouldUseMultipart: (file) => (file.size ?? 0) > MULTIPART_THRESHOLD,
				getChunkSize,
				limit: CONCURRENT_PARTS,
				async getUploadParameters(file) {
					const res = await fetch('/api/uppy/sign', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ filename: file.name, type: file.type })
					});
					if (!res.ok) throw new Error('Failed to get upload parameters');
					const json = await res.json();
					file.meta['r2Key'] = json.key;
					return json;
				},
				async createMultipartUpload(file) {
					const res = await fetch('/api/uppy/multipart', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ filename: file.name, type: file.type })
					});
					if (!res.ok) throw new Error('Failed to create multipart upload');
					const json = await res.json();
					file.meta['r2Key'] = json.key;
					return json;
				},
				async listParts(file, { uploadId, key }) {
					const res = await fetch(`/api/uppy/multipart/${uploadId}?key=${encodeURIComponent(key)}`);
					if (!res.ok) throw new Error('Failed to list parts');
					return res.json();
				},
				async signPart(file, { uploadId, key, partNumber }) {
					const res = await fetch(
						`/api/uppy/multipart/${uploadId}/${partNumber}?key=${encodeURIComponent(key)}`
					);
					if (!res.ok) throw new Error('Failed to sign part');
					return res.json();
				},
				async abortMultipartUpload(file, { uploadId, key }) {
					await fetch(`/api/uppy/multipart/${uploadId}?key=${encodeURIComponent(key)}`, {
						method: 'DELETE'
					});
				},
				async completeMultipartUpload(file, { uploadId, key, parts }) {
					const res = await fetch(
						`/api/uppy/multipart/${uploadId}/complete?key=${encodeURIComponent(key)}`,
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

			this.uppy.on('file-added', () => this.updateState());
			this.uppy.on('file-removed', () => this.updateState());
			this.uppy.on('upload-progress', () => this.updateState());
			this.uppy.on('upload-success', () => this.updateState());
			this.uppy.on('complete', (result) => {
				this.isUploading = false;
				this.totalProgress = 0;
				if (result.successful && result.successful.length > 0) {
					const mapped: UploadResult[] = result.successful.map((file) => ({
						key: (file.meta['r2Key'] as string) || file.name || 'unknown',
						location: (file.response?.body as any)?.location,
						name: file.name || 'unknown',
						size: file.size ?? 0,
						type: file.type || 'application/octet-stream'
					}));
					options.onComplete?.(mapped);

					setTimeout(() => {
						result.successful?.forEach((file) => {
							try {
								this.uppy.removeFile(file.id);
							} catch {}
						});
					}, 3000);
				}
			});
			this.uppy.on('error', (err) => {
				options.onError?.(err);
			});

			this.uppy.on('upload', () => {
				this.isUploading = true;
			});
		}
	}

	updateState() {
		this.files = this.uppy.getFiles();
		this.totalProgress = this.uppy.getState().totalProgress;
	}

	destroy() {
		this.uppy.destroy();
	}

	retryAll() {
		this.uppy.retryAll();
	}
	cancelAll() {
		this.uppy.cancelAll();
	}
	addFile(file: File) {
		this.uppy.addFile({ name: file.name, type: file.type, data: file });
	}
}
