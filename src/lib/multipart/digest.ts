import SparkMD5 from 'spark-md5';
import {
	buildMultipartFingerprintJson,
	buildMultipartPartLayout,
	MULTIPART_PART_BYTES,
	type MultipartManifestPart
} from './protocol.js';

export type MultipartDigest = MultipartManifestPart & { md5Base64: string };
export type MultipartManifest = {
	sizeBytes: number;
	partSizeBytes: number;
	fingerprintHex: string;
	parts: MultipartDigest[];
};
export type MultipartDigestOptions = {
	signal?: AbortSignal;
	onProgress?: (percent: number) => void;
};

type DigestWorkerResponse = { sha256Hex: string; md5Base64: string; error?: string };

function bytesToHex(bytes: Uint8Array): string {
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function digestPart(blob: Blob): Promise<Omit<MultipartDigest, 'partNumber' | 'sizeBytes'>> {
	const bytes = await blob.arrayBuffer();
	const md5 = new SparkMD5.ArrayBuffer();
	try {
		md5.append(bytes);
		const sha256 = await crypto.subtle.digest('SHA-256', bytes);
		return { sha256Hex: bytesToHex(new Uint8Array(sha256)), md5Base64: btoa(md5.end(true)) };
	} finally {
		md5.destroy();
	}
}

function digestInWorker(worker: Worker, blob: Blob, signal?: AbortSignal): Promise<DigestWorkerResponse> {
	return new Promise((resolve, reject) => {
		const cleanup = () => {
			worker.removeEventListener('message', onMessage);
			worker.removeEventListener('error', onError);
			signal?.removeEventListener('abort', onAbort);
		};
		const onMessage = (event: MessageEvent<DigestWorkerResponse>) => {
			cleanup();
			if (event.data.error) reject(new Error(event.data.error));
			else resolve(event.data);
		};
		const onError = () => {
			cleanup();
			reject(new Error('Nie udało się obliczyć sumy kontrolnej części.'));
		};
		const onAbort = () => {
			cleanup();
			reject(new DOMException('Weryfikacja pliku została anulowana.', 'AbortError'));
		};
		if (signal?.aborted) {
			onAbort();
			return;
		}
		worker.addEventListener('message', onMessage, { once: true });
		worker.addEventListener('error', onError, { once: true });
		signal?.addEventListener('abort', onAbort, { once: true });
		worker.postMessage(blob);
	});
}

export async function calculateMultipartManifest(
	file: Blob,
	options: MultipartDigestOptions = {}
): Promise<MultipartManifest> {
	options.signal?.throwIfAborted();
	const layout = buildMultipartPartLayout(file.size);
	const worker = typeof Worker === 'undefined'
		? undefined
		: new Worker(new URL('./digest.worker.ts', import.meta.url), { type: 'module' });
	const parts: MultipartDigest[] = [];
	let completedBytes = 0;
	try {
		for (const part of layout) {
			options.signal?.throwIfAborted();
			const start = (part.partNumber - 1) * MULTIPART_PART_BYTES;
			const blob = file.slice(start, start + part.sizeBytes);
			if (blob.size !== part.sizeBytes) throw new Error('Nie udało się odczytać pełnej części pliku.');
			const digest = worker
				? await digestInWorker(worker, blob, options.signal)
				: await digestPart(blob);
			options.signal?.throwIfAborted();
			parts.push({ ...part, ...digest });
			completedBytes += part.sizeBytes;
			options.onProgress?.(Math.floor((completedBytes / file.size) * 100));
		}
		const fingerprintJson = buildMultipartFingerprintJson(file.size, MULTIPART_PART_BYTES, parts);
		const fingerprint = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fingerprintJson));
		options.signal?.throwIfAborted();
		options.onProgress?.(100);
		return {
			sizeBytes: file.size,
			partSizeBytes: MULTIPART_PART_BYTES,
			fingerprintHex: bytesToHex(new Uint8Array(fingerprint)),
			parts
		};
	} finally {
		worker?.terminate();
	}
}
