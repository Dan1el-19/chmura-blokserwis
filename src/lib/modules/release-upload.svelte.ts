export type ReleaseUploadResult = {
	key: string;
	name: string;
	size: number;
};

export type ReleaseUploadOptions = {
	filename: string;
	overwrite: boolean;
	channel?: 'stable' | 'beta';
	tags?: string[];
	notes?: string | null;
	force_update?: boolean;
	versionCode: number;
	minSupportedVersionCode: number;
	rollout: number;
	certificateSha256: string;
	onProgress?: (progress: number) => void;
	onComplete?: (result: ReleaseUploadResult) => void;
	onError?: (error: Error) => void;
};

export class ReleaseUploader {
	progress = $state(0);
	isUploading = $state(false);
	error = $state<string | null>(null);

	private xhr: XMLHttpRequest | null = null;
	private options: ReleaseUploadOptions;

	constructor(options: ReleaseUploadOptions) {
		this.options = options;
	}

	async upload(file: File) {
		this.isUploading = true;
		this.error = null;
		this.progress = 0;

		try {
			const sha256 = await hashFile(file);

			// 1. Get presigned PUT URL from our backend
			const signRes = await fetch('/api/releases/sign', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					filename: this.options.filename,
					type: file.type || 'application/vnd.android.package-archive',
					overwrite: this.options.overwrite,
					channel: this.options.channel ?? 'stable',
					tags: this.options.tags,
					notes: this.options.notes,
					force_update: this.options.force_update
				})
			});

			if (!signRes.ok) {
				const err = await signRes.json();
				throw new Error(err.message || 'Nie udało się pobrać URL-a uploadu');
			}

			const { url, headers, key, release_id } = await signRes.json();

			// 2. PUT directly to R2 via presigned URL with progress tracking
			await new Promise<void>((resolve, reject) => {
				this.xhr = new XMLHttpRequest();
				this.xhr.open('PUT', url);

				if (headers) {
					for (const [k, v] of Object.entries(headers)) {
						this.xhr.setRequestHeader(k, v as string);
					}
				}

				this.xhr.upload.onprogress = (e) => {
					if (e.lengthComputable) {
						this.progress = Math.round((e.loaded / e.total) * 100);
						this.options.onProgress?.(this.progress);
					}
				};

				this.xhr.onload = () => {
					if (this.xhr!.status >= 200 && this.xhr!.status < 300) {
						resolve();
					} else {
						reject(new Error(`Upload nie powiódł się: ${this.xhr!.status}`));
					}
				};

				this.xhr.onerror = () => reject(new Error('Błąd sieci podczas uploadu'));
				this.xhr.onabort = () => reject(new Error('Upload anulowany'));

				this.xhr.send(file);
			});

			// 3. Confirm upload complete
			const completeRes = await fetch('/api/releases/complete', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					release_id,
					size: file.size,
					channel: this.options.channel ?? 'stable',
					version_code: this.options.versionCode,
					min_supported_version_code: this.options.minSupportedVersionCode,
					rollout: this.options.rollout,
					sha256,
					certificate_sha256: this.options.certificateSha256.trim().toLowerCase()
				})
			});
			if (!completeRes.ok) {
				const body = await completeRes.json().catch(() => ({}));
				throw new Error(body.message || body.error || 'Nie udało się zapisać manifestu wydania');
			}

			this.progress = 100;
			this.isUploading = false;
			this.options.onComplete?.({ key, name: this.options.filename, size: file.size });
		} catch (err) {
			this.isUploading = false;
			const message = err instanceof Error ? err.message : 'Upload nie powiódł się';
			this.error = message;
			this.options.onError?.(err instanceof Error ? err : new Error(message));
		}
	}

	cancel() {
		this.xhr?.abort();
		this.isUploading = false;
	}

	destroy() {
		this.cancel();
	}
}

async function hashFile(file: File): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}
