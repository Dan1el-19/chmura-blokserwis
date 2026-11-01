import SparkMD5 from 'spark-md5';

export type ChecksumOptions = { signal?: AbortSignal; onProgress?: (percent: number) => void };

// Bound temporary memory and keep the fallback responsive between chunks.
export async function calculateMd5InChunks(
	blob: Blob,
	options: ChecksumOptions = {}
): Promise<string> {
	const hash = new SparkMD5.ArrayBuffer();
	const chunkSize = 2 * 1024 * 1024;
	try {
		options.signal?.throwIfAborted();
		for (let offset = 0; offset < blob.size; offset += chunkSize) {
			const end = Math.min(blob.size, offset + chunkSize);
			const chunk = await blob.slice(offset, end).arrayBuffer();
			options.signal?.throwIfAborted();
			hash.append(chunk);
			options.onProgress?.(Math.round((end / blob.size) * 100));
		}
		options.signal?.throwIfAborted();
		options.onProgress?.(100);
		return btoa(hash.end(true));
	} finally {
		hash.destroy();
	}
}
