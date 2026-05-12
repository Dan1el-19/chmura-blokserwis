/**
 * Upload Manager — dual-destination uploader with R2 multipart + Appwrite fallback.
 *
 * Interface mirrors the legacy `UppyState` so existing components (UppyZone,
 * UploadProgressList, DropZone, StoragePage) keep working without changes. The
 * class is re-exported as `UppyState` at the bottom.
 *
 * Upload strategy:
 *   - R2, file ≤ 100 MiB → single presigned PUT via `/api/upload/r2/init`
 *   - R2, file > 100 MiB → Uppy + @uppy/aws-s3 multipart + @uppy/golden-retriever
 *   - Appwrite          → direct browser → Appwrite Storage.createFile
 */

import { Client as AppwriteClient, Storage as AppwriteStorage } from 'appwrite';

export type UploadDestination = 'r2' | 'appwrite';

/** Pliki > 5 GiB trafiają do R2, mniejsze do Appwrite. */
const AUTO_THRESHOLD_BYTES = 5 * 1024 * 1024 * 1024;

function resolveAutoDestination(sizeBytes: number): UploadDestination {
	return sizeBytes > AUTO_THRESHOLD_BYTES ? 'r2' : 'appwrite';
}

export type UploadResult = {
	uploadId: string;
	key: string;
	location?: string;
	name: string;
	size: number;
	type: string;
};

type UploadFileState = {
	id: string;
	name: string;
	size: number;
	type: string;
	source: File;
	destination: UploadDestination;
	uploadId?: string;
	error?: string;
	progress: {
		percentage: number;
		uploadComplete: boolean;
	};
	controller: AbortController;
	/** Set by multipart flow — used by cancelAll to actively abort on R2 side. */
	abortMultipart?: () => Promise<void> | void;
};

type UploadOptions = {
	maxFileSize?: number | null;
	allowedFileTypes?: string[];
	getFolderId?: () => string | null | undefined;
	isMainStorage?: boolean | (() => boolean);
	/** Default destination when `addFile` is called without an explicit one. */
	destination?: UploadDestination | 'auto' | (() => UploadDestination | 'auto');
	onComplete?: (results: UploadResult[]) => void;
	onError?: (error: Error) => void;
};

// ─── Adaptive chunk size ──────────────────────────────────────────────────────

const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100 MiB
const MIN_CHUNK = 5 * 1024 * 1024; // 5 MiB (R2 minimum)
const MAX_CHUNK = 100 * 1024 * 1024; // 100 MiB
const TARGET_PARTS = 100;

function getAdaptiveChunkSize(fileSize: number): number {
	const minRequired = Math.ceil(fileSize / 10_000);
	const ideal = Math.ceil(fileSize / TARGET_PARTS);
	return Math.max(MIN_CHUNK, Math.min(MAX_CHUNK, Math.max(minRequired, ideal)));
}

// ─── Service worker registration (idempotent) ─────────────────────────────────

let serviceWorkerRegistered = false;
function ensureServiceWorker() {
	if (serviceWorkerRegistered) return;
	if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
	serviceWorkerRegistered = true;
	navigator.serviceWorker.register('/sw.js').catch(() => {
		// Non-fatal — Golden Retriever will fall back to LocalStorage + IndexedDB.
		serviceWorkerRegistered = false;
	});
}

// ─── Validation ───────────────────────────────────────────────────────────────

function isAllowedFile(file: File, options: UploadOptions) {
	if (options.maxFileSize && file.size > options.maxFileSize) {
		throw new Error(`${file.name} exceeds the maximum file size`);
	}

	if (options.allowedFileTypes?.length) {
		const accepted = options.allowedFileTypes.some((type) => {
			if (type.endsWith('/*')) return file.type.startsWith(type.slice(0, -1));
			return file.type === type;
		});

		if (!accepted) {
			throw new Error(`${file.name} is not an allowed file type`);
		}
	}
}

// ─── Upload Manager ───────────────────────────────────────────────────────────

export class UploadManager {
	files = $state<UploadFileState[]>([]);
	totalProgress = $state(0);
	isUploading = $state(false);

	private options: UploadOptions;

	/** Exposed for compatibility with legacy UppyState.uppy.removeFile(id). */
	uppy = {
		removeFile: (id: string) => this.removeFile(id)
	};

	constructor(options: UploadOptions = {}) {
		this.options = options;
	}

	private get isMain(): boolean {
		const v = this.options.isMainStorage;
		return typeof v === 'function' ? v() : v === true;
	}

	private getDefaultDestination(sizeBytes?: number): UploadDestination {
		const v = this.options.destination;
		const resolved = typeof v === 'function' ? v() : v;
		if (resolved === 'auto' || resolved === undefined) {
			return resolveAutoDestination(sizeBytes ?? 0);
		}
		return resolved === 'appwrite' ? 'appwrite' : 'r2';
	}

	private updateProgress(file: UploadFileState, percentage: number, uploadComplete = false) {
		file.progress = { percentage, uploadComplete };
		this.recomputeTotals();
	}

	private recomputeTotals() {
		this.totalProgress = this.files.length
			? Math.round(
					this.files.reduce((total, item) => total + item.progress.percentage, 0) /
						this.files.length
				)
			: 0;
		this.isUploading = this.files.some((item) => !item.error && !item.progress.uploadComplete);
	}

	private async markFailed(file: UploadFileState, error: Error) {
		file.error = error.message;
		this.updateProgress(file, file.progress.percentage, false);

		if (file.uploadId) {
			await fetch('/api/upload/fail', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					upload_id: file.uploadId,
					is_main_storage: this.isMain
				})
			}).catch(() => undefined);
		}

		this.options.onError?.(error);
	}

	// ─── R2: single PUT (≤ 100 MiB) ───────────────────────────────────────────

	private async uploadR2Single(file: UploadFileState) {
		const folderId = this.options.getFolderId?.();
		this.updateProgress(file, 5);

		const initResponse = await fetch('/api/upload/r2/init', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				filename: file.name,
				size: file.size,
				mime_type: file.type || 'application/octet-stream',
				folder_id: folderId || undefined,
				is_main_storage: this.isMain
			}),
			signal: file.controller.signal
		});

		if (!initResponse.ok) {
			const err = await initResponse.json().catch(() => ({}));
			throw new Error(err.error || 'Failed to initialize upload');
		}

		const init = await initResponse.json();
		file.uploadId = init.upload_id;
		this.updateProgress(file, 10);

		// Use XMLHttpRequest for real upload progress tracking.
		await new Promise<void>((resolve, reject) => {
			const xhr = new XMLHttpRequest();

			// Abort XHR when the file's AbortController fires.
			const onAbort = () => xhr.abort();
			file.controller.signal.addEventListener('abort', onAbort);

			xhr.upload.onprogress = (event) => {
				if (event.lengthComputable) {
					// Map bytes progress to 10–90% range.
					const pct = Math.round((event.loaded / event.total) * 80) + 10;
					this.updateProgress(file, pct);
				}
			};

			xhr.onload = () => {
				file.controller.signal.removeEventListener('abort', onAbort);
				if (xhr.status >= 200 && xhr.status < 300) {
					resolve();
				} else {
					reject(new Error(`Upload failed with status ${xhr.status}`));
				}
			};

			xhr.onerror = () => {
				file.controller.signal.removeEventListener('abort', onAbort);
				reject(new Error('Network error during upload'));
			};

			xhr.onabort = () => {
				file.controller.signal.removeEventListener('abort', onAbort);
				reject(new DOMException('Upload cancelled', 'AbortError'));
			};

			xhr.open('PUT', init.presigned_url);
			xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
			xhr.send(file.source);
		});

		this.updateProgress(file, 90);

		const completeResponse = await fetch('/api/upload/complete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				upload_id: init.upload_id,
				is_main_storage: this.isMain
			}),
			signal: file.controller.signal
		});

		if (!completeResponse.ok) {
			const err = await completeResponse.json().catch(() => ({}));
			throw new Error(err.error || 'Failed to complete upload');
		}

		this.updateProgress(file, 100, true);
		return {
			uploadId: init.upload_id as string,
			key: init.storage_key as string,
			name: file.name,
			size: file.size,
			type: file.type || 'application/octet-stream'
		} satisfies UploadResult;
	}

	// ─── R2: multipart (> 100 MiB) ────────────────────────────────────────────

	private async uploadR2Multipart(file: UploadFileState): Promise<UploadResult> {
		ensureServiceWorker();

		const folderId = this.options.getFolderId?.();
		this.updateProgress(file, 2);

		// 1. Create multipart upload — reserves quota, stores the upload record
		//    + R2 UploadId in D1.
		const createRes = await fetch('/api/upload/r2/multipart/create', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				filename: file.name,
				size: file.size,
				mime_type: file.type || 'application/octet-stream',
				folder_id: folderId || undefined,
				is_main_storage: this.isMain
			}),
			signal: file.controller.signal
		});

		if (!createRes.ok) {
			const err = await createRes.json().catch(() => ({}));
			throw new Error(err.error || 'Failed to create multipart upload');
		}

		const created = (await createRes.json()) as {
			upload_id: string;
			r2_upload_id: string;
			key: string;
			bucket: string;
			expires_at: number;
		};
		file.uploadId = created.upload_id;

		// Register active abort handler in case the user hits Cancel.
		file.abortMultipart = async () => {
			await fetch('/api/upload/r2/multipart/abort', {
				method: 'DELETE',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ upload_id: created.upload_id })
			}).catch(() => undefined);
		};

		// 2. Lazy-load Uppy to keep the initial bundle small.
		const [{ default: Uppy }, { default: AwsS3 }, { default: GoldenRetriever }] = await Promise.all(
			[import('@uppy/core'), import('@uppy/aws-s3'), import('@uppy/golden-retriever')]
		);

		const uppy = new Uppy({
			autoProceed: true,
			allowMultipleUploads: true,
			debug: false
		})
			.use(GoldenRetriever, { serviceWorker: true })
			.use(AwsS3, {
				// This Uppy instance is dedicated to one multipart upload — never fall
				// back to single PUT.
				shouldUseMultipart: true,
				getChunkSize: (f: { size: number }) => getAdaptiveChunkSize(f.size),

				// Pre-created — Uppy does not need to call the real CreateMultipartUpload.
				createMultipartUpload: async () => ({
					uploadId: created.upload_id,
					key: created.key
				}),

				signPart: async (_f, opts) => {
					const params = new URLSearchParams({
						upload_id: opts.uploadId,
						part_number: String(opts.partNumber)
					});
					const res = await fetch(`/api/upload/r2/multipart/sign-part?${params}`, {
						signal: opts.signal
					});
					if (!res.ok) {
						const err = await res.json().catch(() => ({}));
						throw new Error(err.error || 'Failed to sign part');
					}
					const data = (await res.json()) as { url: string };
					return { method: 'PUT', url: data.url };
				},

				listParts: async (_f, opts) => {
					const params = new URLSearchParams({ upload_id: String(opts.uploadId) });
					const res = await fetch(`/api/upload/r2/multipart/list-parts?${params}`, {
						signal: opts.signal
					});
					if (!res.ok) return [];
					const data = (await res.json()) as {
						parts: Array<{ PartNumber: number; ETag: string; Size: number }>;
					};
					return data.parts;
				},

				completeMultipartUpload: async (_f, opts) => {
					const res = await fetch('/api/upload/r2/multipart/complete', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							upload_id: opts.uploadId,
							parts: opts.parts.map((p) => ({ PartNumber: p.PartNumber, ETag: p.ETag }))
						}),
						signal: opts.signal
					});
					if (!res.ok) {
						const err = await res.json().catch(() => ({}));
						throw new Error(err.error || 'Failed to complete multipart upload');
					}
					return {};
				},

				abortMultipartUpload: async (_f, opts) => {
					await fetch('/api/upload/r2/multipart/abort', {
						method: 'DELETE',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({ upload_id: opts.uploadId }),
						signal: opts.signal
					}).catch(() => undefined);
				},

				retryDelays: [0, 1000, 3000, 5000],
				limit: 5
			});

		const uppyFileId = uppy.addFile({
			name: file.name,
			type: file.type || 'application/octet-stream',
			data: file.source,
			meta: { internalUploadId: created.upload_id }
		});

		uppy.on('upload-progress', (uppyFile, progress) => {
			if (!uppyFile || uppyFile.id !== uppyFileId) return;
			const percent = progress.bytesTotal
				? Math.min(99, Math.round((progress.bytesUploaded / progress.bytesTotal) * 98) + 2)
				: 2;
			this.updateProgress(file, percent);
		});

		// Trigger cancellation via AbortController on the file-level controller.
		const cancelSub = () => {
			uppy.cancelAll();
		};
		file.controller.signal.addEventListener('abort', cancelSub);

		try {
			const result = await uppy.upload();
			const failed = result?.failed ?? [];
			if (failed.length > 0) {
				const first = failed[0] as { error?: unknown };
				const message =
					typeof first.error === 'string'
						? first.error
						: first.error && typeof first.error === 'object' && 'message' in first.error
							? String((first.error as { message?: unknown }).message)
							: 'Multipart upload failed';
				throw new Error(message);
			}
		} finally {
			file.controller.signal.removeEventListener('abort', cancelSub);
		}

		this.updateProgress(file, 100, true);
		return {
			uploadId: created.upload_id,
			key: created.key,
			name: file.name,
			size: file.size,
			type: file.type || 'application/octet-stream'
		} satisfies UploadResult;
	}

	// ─── Appwrite: direct SDK call ────────────────────────────────────────────

	private async uploadAppwrite(file: UploadFileState): Promise<UploadResult> {
		const folderId = this.options.getFolderId?.();
		this.updateProgress(file, 5);

		const initResponse = await fetch('/api/upload/appwrite/init', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				filename: file.name,
				size: file.size,
				mime_type: file.type || 'application/octet-stream',
				folder_id: folderId || undefined,
				is_main_storage: this.isMain
			}),
			signal: file.controller.signal
		});

		if (!initResponse.ok) {
			const err = await initResponse.json().catch(() => ({}));
			throw new Error(err.error || 'Failed to initialize Appwrite upload');
		}

		const init = (await initResponse.json()) as {
			upload_id: string;
			appwrite_endpoint: string;
			appwrite_project_id: string;
			appwrite_bucket_id: string;
			file_id: string;
			expires_at: number;
			jwt: string;
		};
		file.uploadId = init.upload_id;
		this.updateProgress(file, 15);

		if (!init.jwt) {
			throw new Error('Appwrite upload requires JWT authentication');
		}

		// JWT wygenerowany server-side (gdzie mamy dostęp do cookie __session).
		const client = new AppwriteClient()
			.setEndpoint(init.appwrite_endpoint)
			.setProject(init.appwrite_project_id)
			.setJWT(init.jwt);
		const storage = new AppwriteStorage(client);

		try {
			await storage.createFile({
				bucketId: init.appwrite_bucket_id,
				fileId: init.file_id,
				file: file.source,
				onProgress: (progress) => {
					// onProgress is only called for files > 5 MB (chunked uploads).
					const pct = progress.progress ?? 0;
					this.updateProgress(file, Math.max(15, Math.min(95, Math.round(pct * 0.8 + 15))));
				}
			});
		} catch (err) {
			const message =
				err instanceof Error ? err.message : 'Failed to upload file to Appwrite Storage';
			throw new Error(message);
		}

		// For files ≤ 5 MB the SDK skips chunking and never calls onProgress.
		// Jump straight to 95% here so the bar doesn't stay frozen at 15%.
		this.updateProgress(file, 95);

		const completeResponse = await fetch('/api/upload/complete', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				upload_id: init.upload_id,
				is_main_storage: this.isMain
			}),
			signal: file.controller.signal
		});

		if (!completeResponse.ok) {
			const err = await completeResponse.json().catch(() => ({}));
			throw new Error(err.error || 'Failed to complete Appwrite upload');
		}

		this.updateProgress(file, 100, true);
		return {
			uploadId: init.upload_id,
			key: init.file_id,
			name: file.name,
			size: file.size,
			type: file.type || 'application/octet-stream'
		} satisfies UploadResult;
	}

	// ─── Dispatcher ───────────────────────────────────────────────────────────

	private async uploadFile(file: UploadFileState) {
		try {
			let result: UploadResult;
			if (file.destination === 'appwrite') {
				result = await this.uploadAppwrite(file);
			} else if (file.size > MULTIPART_THRESHOLD) {
				result = await this.uploadR2Multipart(file);
			} else {
				result = await this.uploadR2Single(file);
			}

			this.options.onComplete?.([result]);
			setTimeout(() => this.removeFile(file.id), 3000);
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				await this.markFailed(file, new Error('Upload cancelled'));
				return;
			}
			await this.markFailed(file, error instanceof Error ? error : new Error('Upload failed'));
		}
	}

	// ─── Public API (legacy-compatible) ───────────────────────────────────────

	addFile(source: File, destination?: UploadDestination | 'auto') {
		try {
			isAllowedFile(source, this.options);

			const dest = destination === 'auto' || destination === undefined
				? resolveAutoDestination(source.size)
				: destination;

			const resolvedDestination = dest ?? this.getDefaultDestination(source.size);
			const file: UploadFileState = {
				id: crypto.randomUUID(),
				name: source.name,
				size: source.size,
				type: source.type || 'application/octet-stream',
				source,
				destination: resolvedDestination,
				progress: { percentage: 0, uploadComplete: false },
				controller: new AbortController()
			};

			this.files = [...this.files, file];
			this.isUploading = true;
			this.uploadFile(file);
		} catch (error) {
			this.options.onError?.(error instanceof Error ? error : new Error('Upload failed'));
		}
	}

	removeFile(id: string) {
		const file = this.files.find((item) => item.id === id);
		if (file && !file.progress.uploadComplete && !file.error) {
			file.controller.abort();
			// Best-effort: release R2 multipart slot server-side.
			file.abortMultipart?.();
		}
		this.files = this.files.filter((item) => item.id !== id);
		this.recomputeTotals();
	}

	retryAll() {
		const errored = this.files.filter((f) => f.error);
		for (const file of errored) {
			file.error = undefined;
			file.uploadId = undefined;
			file.abortMultipart = undefined;
			file.controller = new AbortController();
			file.progress = { percentage: 0, uploadComplete: false };
			this.uploadFile(file);
		}
		this.recomputeTotals();
	}

	cancelAll() {
		for (const file of this.files) {
			if (!file.progress.uploadComplete) {
				file.controller.abort();
				file.abortMultipart?.();
			}
		}
		this.files = [];
		this.totalProgress = 0;
		this.isUploading = false;
	}

	destroy() {
		this.cancelAll();
	}
}

// ─── Backwards-compatible alias ───────────────────────────────────────────────

/**
 * @deprecated Use `UploadManager` directly. Kept as an alias so existing
 * components can keep importing `UppyState` from this module.
 */
export const UppyState = UploadManager;
export type UppyState = UploadManager;
