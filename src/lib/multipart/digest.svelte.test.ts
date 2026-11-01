import { expect, it } from 'vitest';
import { buildMultipartFingerprintJson, MULTIPART_PART_BYTES } from './protocol.js';
import { calculateMultipartManifest } from './digest.js';

async function sha256Hex(bytes: Uint8Array): Promise<string> {
	const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes.slice().buffer));
	return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

it('hashes each part in the worker and returns the protocol fingerprint and transport MD5', async () => {
	const progress: number[] = [];
	const file = new File(['hello'], 'hello.txt', { lastModified: 1 });
	const manifest = await calculateMultipartManifest(file, {
		onProgress: (percent) => progress.push(percent)
	});
	const part = manifest.parts[0]!;
	const expectedFingerprintJson = buildMultipartFingerprintJson(
		file.size,
		MULTIPART_PART_BYTES,
		manifest.parts
	);

	expect(part).toMatchObject({
		partNumber: 1,
		sizeBytes: 5,
		sha256Hex: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
		md5Base64: 'XUFAKrxLKna5cZ2REBfFkg=='
	});
	expect(manifest.fingerprintHex).toBe(
		await sha256Hex(new TextEncoder().encode(expectedFingerprintJson))
	);
	expect(progress.at(-1)).toBe(100);
});

it('aborts worker hashing before starting another part', async () => {
	const controller = new AbortController();
	const bytes = new Uint8Array(3 * 1024 * 1024);
	const file = new File([bytes], 'large.bin');
	await expect(
		calculateMultipartManifest(file, {
			signal: controller.signal,
			onProgress: () => controller.abort()
		})
	).rejects.toMatchObject({ name: 'AbortError' });
});
