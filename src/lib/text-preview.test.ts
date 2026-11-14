import { expect, it, vi } from 'vitest';
import { readTextPreview, TEXT_PREVIEW_LIMIT } from './text-preview.js';

it('bounds bytes and cancels the stream even when the server ignores Range', async () => {
	let pulls = 0;
	const cancel = vi.fn();
	const stream = new ReadableStream<Uint8Array>({
		pull(controller) { pulls++; controller.enqueue(new Uint8Array(400_000).fill(65)); },
		cancel
	});
	const fetcher = vi.fn<typeof fetch>(async () => new Response(stream, { status: 200 }));
	const result = await readTextPreview('https://storage.example/large', undefined, fetcher);
	expect(result.text.length).toBe(TEXT_PREVIEW_LIMIT);
	expect(result.truncated).toBe(true);
	expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual({ Range: `bytes=0-${TEXT_PREVIEW_LIMIT}` });
	expect(cancel).toHaveBeenCalledOnce();
	expect(pulls).toBeLessThanOrEqual(4);
});

it('decodes short UTF-8 content and reports network errors', async () => {
	const result = await readTextPreview('https://storage.example/small', undefined, async () => new Response('Zażółć'));
	expect(result).toEqual({ text: 'Zażółć', truncated: false });
	await expect(readTextPreview('https://storage.example/error', undefined, async () => new Response('', { status: 503 }))).rejects.toThrow();
});
