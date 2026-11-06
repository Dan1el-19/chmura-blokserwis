import { describe, expect, it } from 'vitest';
import { partialDescription } from './ai-progress.js';

describe('partial AI description', () => {
	it('shows decoded completed and currently streaming fields without JSON syntax', () => {
		expect(partialDescription('{"introduction":"Dzień dobry", "scope":"Montaż\\nkam')).toEqual([
			{ label: 'Wstęp', text: 'Dzień dobry' },
			{ label: 'Zakres prac', text: 'Montaż\nkam' }
		]);
	});
	it('ignores incomplete escape sequences', () => {
		expect(partialDescription('{"introduction":"Tekst\\u0')).toEqual([{ label: 'Wstęp', text: 'Tekst' }]);
	});
});
