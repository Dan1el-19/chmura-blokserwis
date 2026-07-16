export type QuotationAiStreamEvent =
	| { type: 'operation.started'; operationId: string }
	| { type: 'status'; stage: 'preparing' | 'research' | 'generating' | 'saving'; message: string }
	| { type: 'web_search.started'; itemId: string; itemName: string; query: string }
	| {
			type: 'web_search.completed';
			itemId: string;
			itemName: string;
			query: string;
			sources: Array<{ title: string; url: string; description?: string }>;
	  }
	| { type: 'reasoning.delta'; delta: string }
	| { type: 'content.delta'; delta: string }
	| {
			type: 'field.preview';
			field: 'introduction' | 'item_description' | 'block_title' | 'block_content' | 'revision';
			value: string;
			itemId?: string;
			blockIndex?: number;
			partial: boolean;
	  }
	| { type: 'attempt.reset'; attempt: number }
	| { type: 'result'; data: Record<string, any> }
	| { type: 'error'; code: string; message: string }
	| { type: 'done' };

export class QuotationAiStreamError extends Error {
	constructor(
		message: string,
		public readonly code = 'quotation_ai_provider_error'
	) {
		super(message);
		this.name = 'QuotationAiStreamError';
	}
}

export async function consumeQuotationAiStream(
	response: Response,
	onEvent: (event: QuotationAiStreamEvent) => void
): Promise<Record<string, any>> {
	if (!response.ok) {
		const payload = await response.json().catch(() => ({}));
		throw new QuotationAiStreamError(
			payload?.error?.message ?? payload?.message ?? 'Generowanie nie powiodło się.',
			payload?.error?.code
		);
	}
	if (!response.body) throw new QuotationAiStreamError('Serwer nie zwrócił strumienia odpowiedzi.');

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	let buffer = '';
	let result: Record<string, any> | undefined;
	const consumeBlock = (block: string) => {
		for (const line of block.split(/\r?\n/)) {
			if (!line.startsWith('data:')) continue;
			const value = line.slice(5).trimStart();
			if (!value) continue;
			let event: QuotationAiStreamEvent;
			try {
				event = JSON.parse(value) as QuotationAiStreamEvent;
			} catch {
				throw new QuotationAiStreamError('Serwer zwrócił uszkodzony fragment strumienia.');
			}
			onEvent(event);
			if (event.type === 'result') result = event.data;
			if (event.type === 'error') throw new QuotationAiStreamError(event.message, event.code);
		}
	};

	try {
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const blocks = buffer.split(/\r?\n\r?\n/);
			buffer = blocks.pop() ?? '';
			for (const block of blocks) consumeBlock(block);
		}
		buffer += decoder.decode();
		if (buffer.trim()) consumeBlock(buffer);
	} finally {
		reader.releaseLock();
	}
	if (!result) throw new QuotationAiStreamError('Strumień zakończył się bez zapisanej wyceny.');
	return result;
}
