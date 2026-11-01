import { expect, it } from 'vitest';
import {
	MAX_MULTIPART_FILE_BYTES,
	MULTIPART_PART_BYTES,
	buildMultipartPartLayout,
	buildMultipartFingerprintJson,
	canCreateMultipartUpload
} from './protocol.js';

it('uses the protocol 32 MiB part layout, including the 10 GB final part', () => {
	expect(MULTIPART_PART_BYTES).toBe(33_554_432);
	expect(buildMultipartPartLayout(MAX_MULTIPART_FILE_BYTES)).toHaveLength(299);
	expect(buildMultipartPartLayout(MAX_MULTIPART_FILE_BYTES).at(-1)).toEqual({
		partNumber: 299,
		sizeBytes: 779_264
	});
	expect(buildMultipartPartLayout(MULTIPART_PART_BYTES + 12)).toEqual([
		{ partNumber: 1, sizeBytes: MULTIPART_PART_BYTES },
		{ partNumber: 2, sizeBytes: 12 }
	]);
});

it('serializes the fingerprint manifest in the normative key order without whitespace', () => {
	const canonical = buildMultipartFingerprintJson(MULTIPART_PART_BYTES + 1, MULTIPART_PART_BYTES, [
		{ partNumber: 1, sizeBytes: MULTIPART_PART_BYTES, sha256Hex: 'a'.repeat(64) },
		{ partNumber: 2, sizeBytes: 1, sha256Hex: 'b'.repeat(64) }
	]);

	expect(canonical).toBe(
		`{"algorithm":"file-part-fingerprint-v1","size":33554433,"partBytes":33554432,"parts":[{"size":33554432,"sha256":"${'a'.repeat(64)}"},{"size":1,"sha256":"${'b'.repeat(64)}"}]}`
	);
});

it('rejects a manifest with missing, reordered, or incorrectly sized parts', () => {
	const part = { partNumber: 1, sizeBytes: MULTIPART_PART_BYTES, sha256Hex: 'a'.repeat(64) };
	const last = { partNumber: 2, sizeBytes: 1, sha256Hex: 'b'.repeat(64) };
	expect(() =>
		buildMultipartFingerprintJson(MULTIPART_PART_BYTES + 1, MULTIPART_PART_BYTES, [part])
	).toThrow();
	expect(() =>
		buildMultipartFingerprintJson(MULTIPART_PART_BYTES + 1, MULTIPART_PART_BYTES, [
			last,
			part
		])
	).toThrow();
	expect(() =>
		buildMultipartFingerprintJson(MULTIPART_PART_BYTES + 1, MULTIPART_PART_BYTES, [
			part,
			{ ...last, sizeBytes: 2 }
		])
	).toThrow();
});

it('keeps creation disabled unless the injected server capability matches protocol limits', () => {
	const enabled = {
		enabled: true,
		maxFileBytes: 10_000_000_000n,
		partSizeBytes: 33_554_432n,
		maxParallelParts: 2,
		protocol: 'MULTIPART_V1'
	};
	const disabled = { ...enabled, enabled: false };

	expect(canCreateMultipartUpload(undefined, 100_000_001)).toBe(false);
	expect(canCreateMultipartUpload(disabled, 100_000_001)).toBe(false);
	expect(canCreateMultipartUpload(enabled, 100_000_001)).toBe(true);
	expect(canCreateMultipartUpload({ ...enabled, protocol: '' }, 100_000_001)).toBe(false);
	expect(canCreateMultipartUpload({ ...enabled, partSizeBytes: 1n }, 100_000_001)).toBe(false);
	expect(canCreateMultipartUpload({ ...enabled, maxParallelParts: 3 }, 100_000_001)).toBe(false);
	expect(canCreateMultipartUpload(enabled, 10_000_000_001)).toBe(false);
});
