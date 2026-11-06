import { describe, expect, it } from 'vitest';
import { shouldPollQuote } from './ui.js';

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
