export const TEXT_PREVIEW_LIMIT = 1024 * 1024;

export async function readTextPreview(
	url: string,
	signal?: AbortSignal,
	fetcher: typeof fetch = fetch
): Promise<{ text: string; truncated: boolean }> {
	const response = await fetcher(url, {
		headers: { Range: `bytes=0-${TEXT_PREVIEW_LIMIT}` },
		cache: 'no-store',
		referrerPolicy: 'no-referrer',
		...(signal ? { signal } : {})
	});
	if (!response.ok || !response.body) throw new Error('Nie udało się odczytać podglądu tekstu.');
	const reader = response.body.getReader();
	const decoder = new TextDecoder('utf-8');
	let bytes = 0;
	let text = '';
	let truncated = false;
	try {
		while (true) {
			const chunk = await reader.read();
			if (chunk.done) break;
			const remaining = TEXT_PREVIEW_LIMIT - bytes;
			const part = chunk.value.subarray(0, remaining);
			bytes += part.byteLength;
			text += decoder.decode(part, { stream: true });
			if (chunk.value.byteLength > remaining) {
				truncated = true;
				await reader.cancel();
				break;
			}
		}
		if (!truncated) text += decoder.decode();
		return { text, truncated };
	} finally {
		reader.releaseLock();
	}
}
