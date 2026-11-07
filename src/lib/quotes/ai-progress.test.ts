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

describe('research sources', () => {
	it('deduplicates safe links and excludes unsafe protocols', async () => {
		const { researchSources } = await import('./ai-progress.js');
		expect(researchSources([
			{ sources: [{ title: 'Karta', url: 'https://example.com/a' }, { title: 'Zły', url: 'javascript:alert(1)' }] },
			{ sources: [{ title: 'Kopia', url: 'https://example.com/a' }] }
		])).toEqual([{ title: 'Karta', url: 'https://example.com/a' }]);
	});
});
