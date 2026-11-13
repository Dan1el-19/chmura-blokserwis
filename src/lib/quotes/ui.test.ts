import { describe, expect, it } from 'vitest';
import { formatQuoteLineValue, shouldPollQuote } from './ui.js';

describe('quote line display values', () => {
	it('multiplies decimal strings exactly and rounds each line to grosze', () => {
		expect(formatQuoteLineValue('0.5', '0.01')).toBe('0,01 zł');
		expect(formatQuoteLineValue('2,5', '19,99')).toBe('49,98 zł');
		expect(formatQuoteLineValue('999999999999', '999999999999')).toBe('999 999 999 998 000 000 000 001,00 zł');
	});
	it('does not invent a value for incomplete or invalid inputs', () => {
		for (const [quantity, price] of [['', '10'], ['0', '5'], ['-1', '5'], ['1', ''], ['1.123456789', '1']]) {
			expect(formatQuoteLineValue(quantity, price)).toBe('—');
		}
	});
});

describe('quote status polling', () => {
	it('waits without polling when there are no pending tasks', () => {
		expect(shouldPollQuote([undefined, 'succeeded', 'failed'], false)).toBe(false);
	});
	it('polls while a task is queued or running, or after a status read failed', () => {
		expect(shouldPollQuote(['succeeded', 'queued'], false)).toBe(true);
		expect(shouldPollQuote(['running'], false)).toBe(true);
		expect(shouldPollQuote([], true)).toBe(true);
	});
});
