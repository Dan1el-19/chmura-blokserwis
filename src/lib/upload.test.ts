import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	MAX_UPLOAD_BYTES,
	UploadTargetError,
	calculateMd5Base64,
	uploadToTarget,
	validateUploadSize
} from './upload';

class FakeXMLHttpRequest {
	static latest: FakeXMLHttpRequest | undefined;
	upload: { onprogress: ((event: ProgressEvent) => void) | null } = { onprogress: null };
	headers = new Map<string, string>();
	method = '';
	url = '';
	body: Blob | null = null;
	status = 0;
	aborted = false;
	onload: (() => void) | null = null;
	onerror: (() => void) | null = null;
	onabort: (() => void) | null = null;

	constructor() {
		FakeXMLHttpRequest.latest = this;
	}

	open(method: string, url: string) {
		this.method = method;
		this.url = url;
	}

	setRequestHeader(name: string, value: string) {
		this.headers.set(name, value);
	}

	send(body: Blob) {
		this.body = body;
	}

	abort() {
		this.aborted = true;
		this.onabort?.();
	}
}

afterEach(() => {
	vi.unstubAllGlobals();
	FakeXMLHttpRequest.latest = undefined;
});

describe('single PUT upload constraints', () => {
	it('accepts empty files and the exact byte limit', () => {
		expect(validateUploadSize(0)).toBe(true);
		expect(validateUploadSize(MAX_UPLOAD_BYTES)).toBe(true);
	});

	it('rejects files above the backend single PUT limit', () => {
		expect(validateUploadSize(MAX_UPLOAD_BYTES + 1)).toBe(false);
	});

	it('calculates the base64 MD5 required by the signed PUT', async () => {
		expect(await calculateMd5Base64(new Blob([]))).toBe('1B2M2Y8AsgTpgAmY7PhCfg==');
		expect(await calculateMd5Base64(new Blob(['hello']))).toBe('XUFAKrxLKna5cZ2REBfFkg==');
	});

	it('sends the signed headers and reports byte progress', async () => {
		vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
		const file = new Blob(['hello']);
		const controller = new AbortController();
		let progress: [number, number] | undefined;
		const result = uploadToTarget(file, 'https://r2.example/signed', {
			'Content-Type': 'application/octet-stream',
			'Content-MD5': 'XUFAKrxLKna5cZ2REBfFkg==',
			'If-None-Match': '*'
		}, {
			signal: controller.signal,
			onProgress: (loaded, total) => { progress = [loaded, total]; }
		});
		const request = FakeXMLHttpRequest.latest!;
		expect(request.method).toBe('PUT');
		expect(request.url).toBe('https://r2.example/signed');
		expect(request.body).toBe(file);
		expect(request.headers).toEqual(new Map([
			['Content-Type', 'application/octet-stream'],
			['Content-MD5', 'XUFAKrxLKna5cZ2REBfFkg=='],
			['If-None-Match', '*']
		]));
		request.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 5 } as ProgressEvent);
		expect(progress).toEqual([5, 5]);
		request.status = 200;
		request.onload?.();
		await expect(result).resolves.toBeUndefined();
	});

	it('aborts the PUT when the user cancels and reports R2 failures', async () => {
		vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
		const controller = new AbortController();
		const cancelled = uploadToTarget(new Blob(['x']), 'https://r2.example/signed', {}, {
			signal: controller.signal,
			onProgress: () => {}
		});
		controller.abort();
		await expect(cancelled).rejects.toMatchObject({ name: 'AbortError' });
		expect(FakeXMLHttpRequest.latest?.aborted).toBe(true);

		const failed = uploadToTarget(new Blob(['x']), 'https://r2.example/signed', {}, {
			signal: new AbortController().signal,
			onProgress: () => {}
		});
		FakeXMLHttpRequest.latest!.status = 403;
		FakeXMLHttpRequest.latest!.onload?.();
		await expect(failed).rejects.toBeInstanceOf(UploadTargetError);
		await expect(failed).rejects.toMatchObject({ status: 403 });
		await expect(failed).rejects.toMatchObject({ message: 'Przesyłanie pliku nie powiodło się (HTTP 403).' });
	});
});

describe('dynamic upload size limit', () => {
	it('accepts the configured per-file limit while retaining the technical ceiling', async () => {
		const { validateUploadSize, MAX_UPLOAD_BYTES } = await import('./upload.js');
		expect(validateUploadSize(1_500_000, 1_500_000)).toBe(true);
		expect(validateUploadSize(1_500_001, 1_500_000)).toBe(false);
		expect(validateUploadSize(MAX_UPLOAD_BYTES + 1, MAX_UPLOAD_BYTES + 1)).toBe(false);
	});
});

it('identifies transport failures separately from arbitrary errors', async () => {
	vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
	const pending = uploadToTarget(new Blob(['x']), 'https://storage.example/signed', {}, {
		signal: new AbortController().signal,
		onProgress: () => {}
	});
	FakeXMLHttpRequest.latest!.onerror?.();
	await expect(pending).rejects.toMatchObject({ name: 'UploadTransportError' });
});

it('ignores late progress callbacks after a PUT has already settled', async () => {
	vi.stubGlobal('XMLHttpRequest', FakeXMLHttpRequest);
	const progress = vi.fn();
	const pending = uploadToTarget(new Blob(['x']), 'https://storage.example/signed', {}, {
		signal: new AbortController().signal,
		onProgress: progress
	});
	const request = FakeXMLHttpRequest.latest!;
	request.status = 503;
	request.onload?.();
	await expect(pending).rejects.toMatchObject({ status: 503 });
	request.upload.onprogress?.({ lengthComputable: true, loaded: 1, total: 1 } as ProgressEvent);
	expect(progress).not.toHaveBeenCalled();
});

it('can cancel checksum preparation before reading a large file', async () => {
	const controller = new AbortController();
	controller.abort();
	await expect(
		calculateMd5Base64(new Blob(['hello']), { signal: controller.signal })
	).rejects.toMatchObject({ name: 'AbortError' });
});
