export type PdfIdentity = { quoteId: string; draftVersion: bigint; revision: bigint; templateVersion: string };
export function samePdfIdentity(a: PdfIdentity, b: PdfIdentity): boolean {
	return a.quoteId === b.quoteId && a.draftVersion === b.draftVersion && a.revision === b.revision && a.templateVersion === b.templateVersion;
}

const maxPdfBytes = 20 * 1024 * 1024;
export async function readPdfResponse(response: Response): Promise<Uint8Array> {
	if (!response.ok) throw new Error('Nie udało się pobrać PDF.');
	const length = Number(response.headers.get('content-length') || 0);
	if (length > maxPdfBytes) throw new Error('PDF przekracza limit 20 MiB.');
	if (!response.body) throw new Error('Plik PDF jest pusty.');
	const reader = response.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	try {
		while (true) {
			const part = await reader.read();
			if (part.done) break;
			size += part.value.length;
			if (size > maxPdfBytes) { await reader.cancel(); throw new Error('PDF przekracza limit 20 MiB.'); }
			chunks.push(part.value);
		}
	} finally { reader.releaseLock(); }
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
	if (size < 5 || new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-') throw new Error('Nieprawidłowy plik PDF.');
	return bytes;
}
