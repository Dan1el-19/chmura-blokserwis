import { calculateMd5InChunks, type ChecksumOptions } from './checksum.js';

export const MAX_UPLOAD_BYTES = 100_000_000;

export function validateUploadSize(sizeBytes: number, maxUploadBytes = MAX_UPLOAD_BYTES): boolean {
	return (
		Number.isSafeInteger(sizeBytes) &&
		Number.isSafeInteger(maxUploadBytes) &&
		sizeBytes >= 0 &&
		maxUploadBytes >= 0 &&
		sizeBytes <= Math.min(maxUploadBytes, MAX_UPLOAD_BYTES)
	);
}

export async function calculateMd5Base64(
	blob: Blob,
	options: ChecksumOptions = {}
): Promise<string> {
	options.signal?.throwIfAborted();
	if (typeof Worker === 'undefined') return calculateMd5InChunks(blob, options);
	return new Promise((resolve, reject) => {
		const worker = new Worker(new URL('./checksum.worker.ts', import.meta.url), { type: 'module' });
		const cleanup = () => {
			worker.terminate();
			options.signal?.removeEventListener('abort', abort);
		};
		const abort = () => {
			cleanup();
			reject(new DOMException('Upload anulowany.', 'AbortError'));
		};
		options.signal?.addEventListener('abort', abort, { once: true });
		worker.onmessage = (
			event: MessageEvent<{ progress?: number; digest?: string; error?: string }>
		) => {
			if (event.data.error) {
				cleanup();
				reject(new Error(event.data.error));
			} else if (event.data.digest) {
				cleanup();
				resolve(event.data.digest);
			} else if (event.data.progress !== undefined) options.onProgress?.(event.data.progress);
		};
		worker.onerror = () => {
			cleanup();
			reject(new Error('Nie udało się obliczyć sumy kontrolnej pliku. Spróbuj ponownie.'));
		};
		worker.postMessage(blob);
	});
}

export class UploadTargetError extends Error {
	readonly code?: string;

	constructor(readonly status: number, responseBody = '') {
		super(`Przesyłanie pliku nie powiodło się (HTTP ${status}).`);
		this.name = 'UploadTargetError';
		try {
			const parsed: unknown = JSON.parse(responseBody);
			if (parsed && typeof parsed === 'object' && 'code' in parsed && typeof parsed.code === 'string') {
				this.code = parsed.code;
			}
		} catch {
			// A non-JSON storage response is still an upload failure, but has no safe classification.
		}
	}
}

export class UploadTransportError extends Error {
	constructor() {
		super('Błąd sieci podczas wysyłania pliku.');
		this.name = 'UploadTransportError';
	}
}

export function uploadToTarget(
	blob: Blob,
	url: string,
	headers: Record<string, string>,
	options: { signal: AbortSignal; onProgress: (loaded: number, total: number) => void }
): Promise<void> {
	return new Promise((resolve, reject) => {
		const request = new XMLHttpRequest();
		const abort = () => request.abort();
		let settled = false;
		const finish = () => {
			settled = true;
			options.signal.removeEventListener('abort', abort);
		};

		if (options.signal.aborted) {
			reject(new DOMException('Upload anulowany.', 'AbortError'));
			return;
		}

		request.open('PUT', url);
		for (const [name, value] of Object.entries(headers)) request.setRequestHeader(name, value);
		request.upload.onprogress = (event) => {
			if (!settled && !options.signal.aborted && event.lengthComputable)
				options.onProgress(event.loaded, event.total);
		};
		request.onload = () => {
			finish();
			if (request.status >= 200 && request.status < 300) resolve();
			else reject(new UploadTargetError(request.status, request.responseText));
		};
		request.onerror = () => {
			finish();
			reject(new UploadTransportError());
		};
		request.onabort = () => {
			finish();
			reject(new DOMException('Upload anulowany.', 'AbortError'));
		};
		options.signal.addEventListener('abort', abort, { once: true });
		request.send(blob);
	});
}
