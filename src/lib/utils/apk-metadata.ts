export type ApkMetadata = {
	packageName: string | null;
	versionName: string | null;
	versionCode: number | null;
	certificateSha256: string | null;
};

type ZipEntry = {
	name: string;
	compression: number;
	compressedSize: number;
	localHeaderOffset: number;
};

const APK_SIGNATURE_BLOCK_MAGIC = 'APK Sig Block 42';
const APK_V2_SIGNATURE_ID = 0x7109871a;
const APK_V3_SIGNATURE_ID = 0xf05368c0;

function readU16(bytes: Uint8Array, offset: number): number {
	return bytes[offset] | (bytes[offset + 1] << 8);
}

function readU32(bytes: Uint8Array, offset: number): number {
	return (
		(bytes[offset] |
			(bytes[offset + 1] << 8) |
			(bytes[offset + 2] << 16) |
			(bytes[offset + 3] << 24)) >>>
		0
	);
}

function readU64(bytes: Uint8Array, offset: number): number {
	return readU32(bytes, offset) + readU32(bytes, offset + 4) * 0x100000000;
}

function assertRange(bytes: Uint8Array, offset: number, length: number, message: string) {
	if (offset < 0 || length < 0 || offset + length > bytes.length) {
		throw new Error(message);
	}
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
	const minimum = Math.max(0, bytes.length - 0xffff - 22);
	for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
		if (readU32(bytes, offset) === 0x06054b50) return offset;
	}
	throw new Error('Nie znaleziono końca archiwum APK');
}

function readZipDirectory(bytes: Uint8Array): { entries: ZipEntry[]; eocdOffset: number } {
	const eocdOffset = findEndOfCentralDirectory(bytes);
	const directorySize = readU32(bytes, eocdOffset + 12);
	const directoryOffset = readU32(bytes, eocdOffset + 16);
	assertRange(bytes, directoryOffset, directorySize, 'Nieprawidłowy katalog ZIP w APK');

	const decoder = new TextDecoder();
	const entries: ZipEntry[] = [];
	let offset = directoryOffset;
	const end = directoryOffset + directorySize;

	while (offset < end) {
		assertRange(bytes, offset, 46, 'Uszkodzony wpis katalogu ZIP');
		if (readU32(bytes, offset) !== 0x02014b50) {
			throw new Error('Nieprawidłowy wpis katalogu ZIP');
		}

		const nameLength = readU16(bytes, offset + 28);
		const extraLength = readU16(bytes, offset + 30);
		const commentLength = readU16(bytes, offset + 32);
		const recordLength = 46 + nameLength + extraLength + commentLength;
		assertRange(bytes, offset, recordLength, 'Uszkodzona nazwa pliku w APK');

		entries.push({
			name: decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength)),
			compression: readU16(bytes, offset + 10),
			compressedSize: readU32(bytes, offset + 20),
			localHeaderOffset: readU32(bytes, offset + 42)
		});
		offset += recordLength;
	}

	return { entries, eocdOffset };
}

async function readZipEntry(bytes: Uint8Array, entry: ZipEntry): Promise<Uint8Array> {
	assertRange(bytes, entry.localHeaderOffset, 30, 'Uszkodzony nagłówek pliku APK');
	if (readU32(bytes, entry.localHeaderOffset) !== 0x04034b50) {
		throw new Error(`Nieprawidłowy nagłówek pliku ${entry.name}`);
	}

	const nameLength = readU16(bytes, entry.localHeaderOffset + 26);
	const extraLength = readU16(bytes, entry.localHeaderOffset + 28);
	const dataOffset = entry.localHeaderOffset + 30 + nameLength + extraLength;
	assertRange(bytes, dataOffset, entry.compressedSize, `Brak danych pliku ${entry.name}`);
	const compressed = bytes.subarray(dataOffset, dataOffset + entry.compressedSize);

	if (entry.compression === 0) return compressed;
	if (entry.compression !== 8 || typeof DecompressionStream === 'undefined') {
		throw new Error(`Nieobsługiwany sposób kompresji pliku ${entry.name}`);
	}

	const stream = new Blob([compressed.slice().buffer as ArrayBuffer])
		.stream()
		.pipeThrough(new DecompressionStream('deflate-raw'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}

function readLength8(bytes: Uint8Array, offset: number): { value: number; size: number } {
	const first = bytes[offset];
	if (first & 0x80) {
		return { value: ((first & 0x7f) << 8) | bytes[offset + 1], size: 2 };
	}
	return { value: first, size: 1 };
}

function readLength16(bytes: Uint8Array, offset: number): { value: number; size: number } {
	const first = readU16(bytes, offset);
	if (first & 0x8000) {
		return { value: ((first & 0x7fff) << 16) | readU16(bytes, offset + 2), size: 4 };
	}
	return { value: first, size: 2 };
}

function readStringPool(bytes: Uint8Array, offset: number): { strings: string[]; end: number } {
	assertRange(bytes, offset, 28, 'Brak puli stringów w AndroidManifest.xml');
	if (readU16(bytes, offset) !== 0x0001) {
		throw new Error('Brak puli stringów w AndroidManifest.xml');
	}

	const headerSize = readU16(bytes, offset + 2);
	const totalSize = readU32(bytes, offset + 4);
	const stringCount = readU32(bytes, offset + 8);
	const flags = readU32(bytes, offset + 16);
	const stringsStart = readU32(bytes, offset + 20);
	const offsetsStart = offset + headerSize;
	assertRange(bytes, offsetsStart, stringCount * 4, 'Uszkodzona pula stringów');
	assertRange(bytes, offset, totalSize, 'Uszkodzony chunk puli stringów');

	const utf8 = (flags & 0x100) !== 0;
	const decoder = new TextDecoder('utf-8');
	const strings: string[] = [];

	for (let index = 0; index < stringCount; index += 1) {
		const stringOffset = offset + stringsStart + readU32(bytes, offsetsStart + index * 4);
		if (utf8) {
			const utf16Length = readLength8(bytes, stringOffset);
			const byteLength = readLength8(bytes, stringOffset + utf16Length.size);
			const valueStart = stringOffset + utf16Length.size + byteLength.size;
			strings.push(decoder.decode(bytes.subarray(valueStart, valueStart + byteLength.value)));
		} else {
			const length = readLength16(bytes, stringOffset);
			const valueStart = stringOffset + length.size;
			const value = new Uint16Array(length.value);
			for (let charIndex = 0; charIndex < length.value; charIndex += 1) {
				value[charIndex] = readU16(bytes, valueStart + charIndex * 2);
			}
			strings.push(String.fromCharCode(...value));
		}
	}

	return { strings, end: offset + totalSize };
}

function parseAndroidManifest(bytes: Uint8Array): {
	packageName: string | null;
	versionName: string | null;
	versionCode: number | null;
} {
	if (readU16(bytes, 0) !== 0x0003) {
		throw new Error('AndroidManifest.xml nie jest w formacie binarnym AXML');
	}

	const { strings, end: stringPoolEnd } = readStringPool(bytes, 8);
	let offset = stringPoolEnd;
	let packageName: string | null = null;
	let versionName: string | null = null;
	let versionCode: number | null = null;

	while (offset + 8 <= bytes.length) {
		const type = readU16(bytes, offset);
		const size = readU32(bytes, offset + 4);
		if (size < 8 || offset + size > bytes.length) break;

		if (type === 0x0102) {
			const nameIndex = readU32(bytes, offset + 20);
			const elementName = strings[nameIndex] ?? '';
			const attributeStart = readU16(bytes, offset + 24);
			const attributeSize = readU16(bytes, offset + 26);
			const attributeCount = readU16(bytes, offset + 28);
			// attributeStart is relative to the attrExt structure, which starts
			// after the 16-byte ResXMLTree_node prefix.
			const attributesOffset = offset + 16 + attributeStart;

			if (elementName === 'manifest') {
				for (let index = 0; index < attributeCount; index += 1) {
					const attributeOffset = attributesOffset + index * attributeSize;
					const attributeName = strings[readU32(bytes, attributeOffset + 4)] ?? '';
					const rawValueIndex = readU32(bytes, attributeOffset + 8);
					const valueType = bytes[attributeOffset + 15];
					const valueData = readU32(bytes, attributeOffset + 16);
					const value =
						valueType === 0x03
							? (strings[valueData] ?? '')
							: rawValueIndex < strings.length
								? (strings[rawValueIndex] ?? String(valueData))
								: String(valueData);

					if (attributeName === 'package') packageName = value;
					if (attributeName === 'versionName') versionName = value || null;
					if (attributeName === 'versionCode') {
						const parsed = Number(value);
						versionCode = Number.isSafeInteger(parsed) ? parsed : valueData;
					}
				}
			}
		}

		offset += size;
	}

	if (!packageName && !versionName && versionCode === null) {
		throw new Error('Nie znaleziono elementu manifest w AndroidManifest.xml');
	}

	return { packageName, versionName, versionCode };
}

function readLengthPrefixed(bytes: Uint8Array, offset: number, limit: number) {
	if (offset + 4 > limit) return null;
	const length = readU32(bytes, offset);
	const start = offset + 4;
	const end = start + length;
	if (end > limit) return null;
	return { start, end, next: end };
}

function readSigningBlockPair(
	bytes: Uint8Array,
	eocdOffset: number,
	pairId: number
): Uint8Array | null {
	const directoryOffset = readU32(bytes, eocdOffset + 16);
	const footerOffset = directoryOffset - 24;
	if (footerOffset < 0 || footerOffset + 24 > bytes.length) return null;

	const magic = new TextDecoder().decode(bytes.subarray(footerOffset + 8, footerOffset + 24));
	if (magic !== APK_SIGNATURE_BLOCK_MAGIC) return null;

	const blockSize = readU64(bytes, footerOffset);
	const blockStart = directoryOffset - blockSize - 8;
	if (blockStart < 0 || blockStart + 8 > bytes.length || readU64(bytes, blockStart) !== blockSize) {
		return null;
	}

	let offset = blockStart + 8;
	while (offset < footerOffset) {
		const pairLength = readU64(bytes, offset);
		const pairEnd = offset + 8 + pairLength;
		if (pairLength < 4 || pairEnd > footerOffset) return null;
		if (readU32(bytes, offset + 8) === pairId) {
			return bytes.subarray(offset + 12, pairEnd);
		}
		offset = pairEnd;
	}

	return null;
}

function extractCertificateFromSigningValue(value: Uint8Array): Uint8Array | null {
	const signers = readLengthPrefixed(value, 0, value.length);
	if (!signers) return null;
	const signer = readLengthPrefixed(value, signers.start, signers.end);
	if (!signer) return null;
	const signedData = readLengthPrefixed(value, signer.start, signer.end);
	if (!signedData) return null;

	const digests = readLengthPrefixed(value, signedData.start, signedData.end);
	if (!digests) return null;
	const certificates = readLengthPrefixed(value, digests.next, signedData.end);
	if (!certificates) return null;
	const certificate = readLengthPrefixed(value, certificates.start, certificates.end);
	return certificate ? value.slice(certificate.start, certificate.end) : null;
}

type DerNode = { start: number; end: number; headerEnd: number; tag: number };

function readDerNode(bytes: Uint8Array, offset: number, limit: number): DerNode | null {
	if (offset + 2 > limit) return null;
	const tag = bytes[offset];
	const lengthByte = bytes[offset + 1];
	let length = lengthByte;
	let headerEnd = offset + 2;
	if (lengthByte & 0x80) {
		const lengthBytes = lengthByte & 0x7f;
		if (lengthBytes === 0 || lengthBytes > 4 || headerEnd + lengthBytes > limit) return null;
		length = 0;
		for (let index = 0; index < lengthBytes; index += 1) {
			length = length * 256 + bytes[headerEnd + index];
		}
		headerEnd += lengthBytes;
	}
	const end = headerEnd + length;
	return end <= limit ? { start: offset, end, headerEnd, tag } : null;
}

function findX509CertificateDer(bytes: Uint8Array): Uint8Array | null {
	let candidate: Uint8Array | null = null;

	function walk(offset: number, limit: number, depth: number) {
		if (depth > 12) return;
		const node = readDerNode(bytes, offset, limit);
		if (!node) return;

		if (node.tag === 0x30) {
			const children: DerNode[] = [];
			let childOffset = node.headerEnd;
			while (childOffset < node.end) {
				const child = readDerNode(bytes, childOffset, node.end);
				if (!child) break;
				children.push(child);
				childOffset = child.end;
			}

			if (
				children.length >= 3 &&
				children[0].tag === 0x30 &&
				children[1].tag === 0x30 &&
				children[2].tag === 0x03 &&
				node.end - node.start > 512
			) {
				const value = bytes.slice(node.start, node.end);
				if (!candidate || value.length < candidate.length) candidate = value;
			}

			for (const child of children) walk(child.start, child.end, depth + 1);
		}
	}

	walk(0, bytes.length, 0);
	return candidate;
}

async function sha256(bytes: Uint8Array): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', bytes.slice().buffer);
	return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function extractCertificateSha256(
	bytes: Uint8Array,
	entries: ZipEntry[],
	eocdOffset: number
): Promise<string | null> {
	const signingValue =
		readSigningBlockPair(bytes, eocdOffset, APK_V2_SIGNATURE_ID) ??
		readSigningBlockPair(bytes, eocdOffset, APK_V3_SIGNATURE_ID);
	let certificate = signingValue ? extractCertificateFromSigningValue(signingValue) : null;

	if (!certificate) {
		const legacyEntry = entries.find((entry) =>
			/^META-INF\/[^/]+\.(RSA|DSA|EC)$/i.test(entry.name)
		);
		if (legacyEntry) certificate = findX509CertificateDer(await readZipEntry(bytes, legacyEntry));
	}

	return certificate ? sha256(certificate) : null;
}

export async function inspectApk(file: Blob): Promise<ApkMetadata> {
	const bytes = new Uint8Array(await file.arrayBuffer());
	const { entries, eocdOffset } = readZipDirectory(bytes);
	const manifestEntry = entries.find((entry) => entry.name === 'AndroidManifest.xml');
	if (!manifestEntry) throw new Error('APK nie zawiera AndroidManifest.xml');

	const manifest = parseAndroidManifest(await readZipEntry(bytes, manifestEntry));
	const certificateSha256 = await extractCertificateSha256(bytes, entries, eocdOffset);

	return { ...manifest, certificateSha256 };
}
