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
	uploadId?: string;
	error?: string;
	progress: {
		percentage: number;
		uploadComplete: boolean;
	};
	controller: AbortController;
};

type UploadOptions = {
	maxFileSize?: number | null;
	allowedFileTypes?: string[];
	getFolderId?: () => string | null | undefined;
	isMainStorage?: boolean | (() => boolean);
	onComplete?: (results: UploadResult[]) => void;
	onError?: (error: Error) => void;
};

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

export class UppyState {
	files = $state<UploadFileState[]>([]);
	totalProgress = $state(0);
	isUploading = $state(false);
	private options: UploadOptions;

	private get isMain(): boolean {
		const v = this.options.isMainStorage;
		return typeof v === 'function' ? v() : v === true;
	}

	uppy = {
		removeFile: (id: string) => this.removeFile(id)
	};

	constructor(options: UploadOptions = {}) {
		this.options = options;
	}

	private updateProgress(file: UploadFileState, percentage: number, uploadComplete = false) {
		file.progress = { percentage, uploadComplete };
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

	private async uploadFile(file: UploadFileState) {
		try {
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
				const error = await initResponse.json().catch(() => ({}));
				throw new Error(error.error || 'Failed to initialize upload');
			}

			const init = await initResponse.json();
			file.uploadId = init.upload_id;
			this.updateProgress(file, 20);

			const putResponse = await fetch(init.presigned_url, {
				method: 'PUT',
				headers: { 'Content-Type': file.type || 'application/octet-stream' },
				body: file.source,
				signal: file.controller.signal
			});

			if (!putResponse.ok) {
				throw new Error(`Upload failed with status ${putResponse.status}`);
			}

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
				const error = await completeResponse.json().catch(() => ({}));
				throw new Error(error.error || 'Failed to complete upload');
			}

			this.updateProgress(file, 100, true);
			this.options.onComplete?.([
				{
					uploadId: init.upload_id,
					key: init.storage_key,
					name: file.name,
					size: file.size,
					type: file.type || 'application/octet-stream'
				}
			]);

			setTimeout(() => this.removeFile(file.id), 3000);
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				await this.markFailed(file, new Error('Upload cancelled'));
				return;
			}

			await this.markFailed(file, error instanceof Error ? error : new Error('Upload failed'));
		}
	}

	removeFile(id: string) {
		const file = this.files.find((item) => item.id === id);
		if (file && !file.progress.uploadComplete && !file.error) {
			file.controller.abort();
		}
		this.files = this.files.filter((item) => item.id !== id);
		this.updateProgress(
			{ progress: { percentage: this.totalProgress, uploadComplete: false } } as UploadFileState,
			this.totalProgress
		);
	}

	destroy() {
		this.cancelAll();
	}

	retryAll() {
		const errored = this.files.filter((file) => file.error);
		for (const file of errored) {
			file.error = undefined;
			file.uploadId = undefined;
			file.controller = new AbortController();
			this.uploadFile(file);
		}
	}

	cancelAll() {
		for (const file of this.files) {
			if (!file.progress.uploadComplete) file.controller.abort();
		}
		this.files = [];
		this.totalProgress = 0;
		this.isUploading = false;
	}

	addFile(source: File) {
		try {
			isAllowedFile(source, this.options);
			const file: UploadFileState = {
				id: crypto.randomUUID(),
				name: source.name,
				size: source.size,
				type: source.type || 'application/octet-stream',
				source,
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
}
