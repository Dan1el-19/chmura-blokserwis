import { expect, it } from 'vitest';
import { calculateMd5Base64 } from './upload.js';

it('hashes a large file in a real worker and reports preparation progress', async () => {
	const progress: number[] = [];
	const file = new Blob([new Uint8Array(6 * 1024 * 1024).fill(97)]);
	expect(await calculateMd5Base64(file, { onProgress: (value) => progress.push(value) })).toBe(
		'DfaElbXvU6jOKp1AdsxiUg=='
	);
	expect(progress).toContain(33);
	expect(progress.at(-1)).toBe(100);
});
it('cancels worker preparation without waiting for the whole file', async () => {
	const controller = new AbortController();
	const file = new Blob([new Uint8Array(20 * 1024 * 1024)]);
	await expect(
		calculateMd5Base64(file, { signal: controller.signal, onProgress: () => controller.abort() })
	).rejects.toMatchObject({ name: 'AbortError' });
});
