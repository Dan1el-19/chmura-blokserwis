import { MAX_UPLOAD_BYTES } from '../upload.js';

export const MAX_MULTIPART_FILE_BYTES = 10_000_000_000;
export const MULTIPART_PART_BYTES = 32 * 1024 * 1024;
export const MAX_MULTIPART_PARTS = Math.ceil(
	MAX_MULTIPART_FILE_BYTES / MULTIPART_PART_BYTES
);
export const MAX_MULTIPART_PARALLEL_PARTS = 2;
export const MULTIPART_PROTOCOL_V1 = 'MULTIPART_V1';
export const FINGERPRINT_ALGORITHM = 'file-part-fingerprint-v1';

export type MultipartManifestPart = {
	partNumber: number;
	sizeBytes: number;
	sha256Hex: string;
};

export type MultipartCapabilities = {
	enabled: boolean;
	maxFileBytes: bigint;
	partSizeBytes: bigint;
	maxParallelParts: number;
	protocol: string;
};

export function buildMultipartPartLayout(
	sizeBytes: number,
	partBytes = MULTIPART_PART_BYTES
): Array<{ partNumber: number; sizeBytes: number }> {
	if (
		!Number.isSafeInteger(sizeBytes) ||
		sizeBytes <= 0 ||
		sizeBytes > MAX_MULTIPART_FILE_BYTES ||
		!Number.isSafeInteger(partBytes) ||
		partBytes !== MULTIPART_PART_BYTES
	) {
		throw new RangeError('Multipart file size or part size is outside the protocol limits.');
	}
	const count = Math.ceil(sizeBytes / partBytes);
	if (count > MAX_MULTIPART_PARTS) throw new RangeError('Multipart part count exceeds the protocol limit.');
	return Array.from({ length: count }, (_, index) => ({
		partNumber: index + 1,
		sizeBytes: Math.min(partBytes, sizeBytes - index * partBytes)
	}));
}

export function buildMultipartFingerprintJson(
	sizeBytes: number,
	partBytes: number,
	parts: MultipartManifestPart[]
): string {
	const expected = buildMultipartPartLayout(sizeBytes, partBytes);
	if (parts.length !== expected.length) throw new Error('Multipart manifest is incomplete.');
	for (const [index, part] of parts.entries()) {
		const expectedPart = expected[index];
		if (
			!expectedPart ||
			part.partNumber !== expectedPart.partNumber ||
			part.sizeBytes !== expectedPart.sizeBytes ||
			!/^[a-f0-9]{64}$/.test(part.sha256Hex)
		) {
			throw new Error('Multipart manifest part layout or SHA-256 is invalid.');
		}
	}
	return JSON.stringify({
		algorithm: FINGERPRINT_ALGORITHM,
		size: sizeBytes,
		partBytes,
		parts: parts.map((part) => ({ size: part.sizeBytes, sha256: part.sha256Hex }))
	});
}

export function canCreateMultipartUpload(
	capabilities: MultipartCapabilities | undefined,
	sizeBytes: number
): boolean {
	return (
		!!capabilities?.enabled &&
		capabilities.protocol === MULTIPART_PROTOCOL_V1 &&
		capabilities.partSizeBytes === BigInt(MULTIPART_PART_BYTES) &&
		capabilities.maxParallelParts > 0 &&
		capabilities.maxParallelParts <= MAX_MULTIPART_PARALLEL_PARTS &&
		Number.isSafeInteger(sizeBytes) &&
		sizeBytes > MAX_UPLOAD_BYTES &&
		sizeBytes <= MAX_MULTIPART_FILE_BYTES &&
		BigInt(sizeBytes) <= capabilities.maxFileBytes
	);
}
