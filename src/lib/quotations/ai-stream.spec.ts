import { describe, expect, it } from 'vitest';
import type { QuotationAiMutationResponse } from '@unisource/sdk/v2';
import {
	QuotationAiStreamError,
	consumeQuotationAiStream,
	type QuotationAiStreamEvent
} from './ai-stream';

function responseFor(events: QuotationAiStreamEvent[]) {
	const encoder = new TextEncoder();
	return new Response(
		new ReadableStream({
			start(controller) {
				const payload = events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join('');
				const split = Math.floor(payload.length / 2);
				controller.enqueue(encoder.encode(payload.slice(0, split)));
				controller.enqueue(encoder.encode(payload.slice(split)));
				controller.close();
			}
		}),
		{ headers: { 'content-type': 'text/event-stream' } }
	);
}

describe('consumeQuotationAiStream', () => {
	it('parses fragmented SSE and returns the final mutation', async () => {
		const received: QuotationAiStreamEvent[] = [];
		const mutation = { item: { id: 'q1' }, operation: { id: 'op1' } } as unknown as QuotationAiMutationResponse;
		const result = await consumeQuotationAiStream(
			responseFor([
				{ type: 'status', stage: 'research', message: 'Szukam urządzeń' },
				{ type: 'content.delta', delta: 'Opis' },
				{ type: 'result', data: mutation },
				{ type: 'done' }
			]),
			(event) => received.push(event)
		);

		expect(result).toEqual(mutation);
		expect(received.map(({ type }) => type)).toEqual([
			'status',
			'content.delta',
			'result',
			'done'
		]);
	});

	it('turns an SSE error event into a typed failure', async () => {
		await expect(
			consumeQuotationAiStream(
				responseFor([{ type: 'error', code: 'quotation_ai_provider_error', message: 'Błąd AI' }]),
				() => undefined
			)
		).rejects.toEqual(expect.objectContaining<Partial<QuotationAiStreamError>>({
			name: 'QuotationAiStreamError',
			code: 'quotation_ai_provider_error'
		}));
	});
});
