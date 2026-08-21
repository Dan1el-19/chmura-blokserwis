import { describe, expect, it } from 'vitest';
import { sortQuotations } from './list';

const quotation = (number: string | undefined, title: string, updatedAt: string) => ({
	id: title,
	document: { number, title },
	updatedAt
});

describe('quotation list sorting', () => {
	it('sorts issued quotation numbers numerically before drafts', () => {
		const result = sortQuotations([
			quotation('W/100/2026', 'Sto', '2026-01-01T00:00:00Z'),
			quotation(undefined, 'Szkic', '2026-08-01T00:00:00Z'),
			quotation('W/12/2026', 'Dwanaście', '2026-08-02T00:00:00Z'),
			quotation('W/2/2026', 'Dwa', '2026-08-03T00:00:00Z')
		]);

		expect(result.map((item) => item.document.number)).toEqual([
			'W/100/2026',
			'W/12/2026',
			'W/2/2026',
			undefined
		]);
	});

	it('uses the latest update and then title as deterministic tie breakers', () => {
		const result = sortQuotations([
			quotation(undefined, 'B', '2026-01-01T00:00:00Z'),
			quotation(undefined, 'A', '2026-01-01T00:00:00Z'),
			quotation(undefined, 'Nowszy', '2026-02-01T00:00:00Z')
		]);

		expect(result.map((item) => item.document.title)).toEqual(['Nowszy', 'A', 'B']);
	});
});
