import { describe, expect, it } from 'vitest';

import {
	normalizeCreateQuotation,
	parseQuotationListQuery,
	quotationIdempotencyKey,
	withoutProxyFields
} from './quotations';

describe('quotation server integration helpers', () => {
	it('normalizes an imported local draft into a valid quotation draft', () => {
		const input = normalizeCreateQuotation({
			title: 'Monitoring Ilumino',
			items: [
				{
					id: 'row-1',
					name: 'Kamera IP',
					shortDescription: '4 MP',
					quantity: 2,
					unit: 'szt.',
					unitGrossCents: 129900,
					totalGrossCents: 259800,
					categoryTitle: 'Monitoring',
					sortOrder: 0,
					sourceRowNumber: 2
				}
			]
		});

		expect(input).toMatchObject({
			title: 'Monitoring Ilumino',
			letterheadVariant: 'orange_axis',
			categories: [{ title: 'Monitoring', sortOrder: 0 }],
			items: [
				{
					id: 'row-1',
					name: 'Kamera IP',
					shortDescription: '4 MP',
					quantity: 2,
					unitGrossCents: 129900,
					sortOrder: 0
				}
			]
		});
		expect(input.items[0].categoryId).toBe(input.categories[0].id);
		expect(input.items[0]).not.toHaveProperty('totalGrossCents');
	});

	it('creates a minimal editable row when a manual draft has no imported items', () => {
		const input = normalizeCreateQuotation({ title: 'Ręczna wycena', items: [] });
		expect(input.categories).toHaveLength(1);
		expect(input.items).toHaveLength(1);
		expect(input.items[0]).toMatchObject({ name: 'Nowa pozycja', quantity: 1, unitGrossCents: 0 });
	});

	it('accepts the localDraft migration envelope used by the browser', () => {
		const input = normalizeCreateQuotation({
			localDraft: {
				id: 'local-1',
				title: 'Szkic lokalny',
				items: []
			}
		});
		expect(input.title).toBe('Szkic lokalny');
		expect(input.items).toHaveLength(1);
	});

	it('removes proxy-only fields without changing the SDK payload', () => {
		expect(
			withoutProxyFields({ idempotencyKey: 'key', localDraftId: 'local', expectedLockVersion: 3 })
		).toEqual({ expectedLockVersion: 3 });
	});

	it('parses and bounds list filters', () => {
		const url = new URL(
			'https://example.test/wyceny?search=Ilumino&year=2026&status=approved&limit=250'
		);
		expect(parseQuotationListQuery(url)).toEqual({
			search: 'Ilumino',
			year: 2026,
			status: 'approved',
			cursor: undefined,
			limit: 50
		});
	});

	it('prefers a stable Idempotency-Key header', () => {
		const request = new Request('https://example.test/api/quotations', {
			headers: { 'Idempotency-Key': 'operation-123' }
		});
		expect(quotationIdempotencyKey(request, { idempotencyKey: 'body-key' })).toBe('operation-123');
	});
});
