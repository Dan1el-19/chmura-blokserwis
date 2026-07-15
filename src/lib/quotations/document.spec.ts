import { describe, expect, it } from 'vitest';
import {
	createManualQuotationDraft,
	importedItemsToQuotationDraft,
	normalizeQuotationDraft,
	quotationDocumentToUpdatePayload
} from './document';

function ids(...values: string[]) {
	let index = 0;
	return () => values[index++] ?? `id-${index}`;
}

describe('quotation document domain', () => {
	it('creates a valid manual draft with at least one category and item', () => {
		const draft = createManualQuotationDraft({ title: '  Alarm  ', id: ids('cat', 'item') });

		expect(draft.title).toBe('Alarm');
		expect(draft.categories).toEqual([{ id: 'cat', title: 'Pozostałe', sortOrder: 0 }]);
		expect(draft.items).toEqual([
			expect.objectContaining({ id: 'item', categoryId: 'cat', quantity: 1, unitGrossCents: 0 })
		]);
	});

	it('groups imported categories by normalized label and drops calculated totals', () => {
		const draft = importedItemsToQuotationDraft(
			'Monitoring',
			[
				{
					id: 'camera',
					name: 'Kamera',
					quantity: 2,
					unit: 'szt.',
					unitGrossCents: 10000,
					totalGrossCents: 20000,
					categoryTitle: ' Urządzenia ',
					sortOrder: 0,
					sourceRowNumber: 2
				},
				{
					id: 'recorder',
					name: 'Rejestrator',
					quantity: 1,
					unit: 'szt.',
					unitGrossCents: 50000,
					totalGrossCents: 50000,
					categoryTitle: 'urzadzenia',
					sortOrder: 1,
					sourceRowNumber: 3
				}
			],
			{ id: ids('category-devices') }
		);

		expect(draft.categories).toHaveLength(1);
		expect(draft.items.map((item) => item.categoryId)).toEqual([
			'category-devices',
			'category-devices'
		]);
		expect(draft.items.every((item) => !('totalGrossCents' in item))).toBe(true);
	});

	it('normalizes ordering, orphan categories and related item identifiers', () => {
		const normalized = normalizeQuotationDraft({
			title: 'Oferta',
			categories: [
				{ id: 'a', title: ' Kamery ', sortOrder: 2 },
				{ id: 'b', title: 'kamery', sortOrder: 1 }
			],
			items: [
				{
					id: 'same',
					name: 'Druga',
					quantity: 1,
					unit: 'szt.',
					unitGrossCents: 1,
					totalGrossCents: 1,
					categoryId: 'missing',
					sortOrder: 2
				},
				{
					id: 'same',
					name: 'Pierwsza',
					quantity: 1,
					unit: 'szt.',
					unitGrossCents: 1,
					totalGrossCents: 1,
					categoryId: 'a',
					sortOrder: 1
				}
			],
			descriptionBlocks: [
				{
					id: 'block',
					label: 'Zakres',
					title: 'Opis',
					content: 'Treść',
					relatedItemIds: ['same', 'missing'],
					source: 'manual'
				}
			]
		});

		expect(normalized.categories.map((category) => category.title)).toEqual([
			'kamery',
			'Pozostałe'
		]);
		expect(normalized.items.map((item) => item.sortOrder)).toEqual([0, 1]);
		expect(new Set(normalized.items.map((item) => item.id)).size).toBe(2);
		expect(normalized.descriptionBlocks?.[0].relatedItemIds).toEqual(['same-2']);
	});

	it('builds an update payload without formal or calculated fields', () => {
		const payload = quotationDocumentToUpdatePayload(
			{
				schemaVersion: 1,
				number: 'W/123/2026',
				issuedAt: '2026-07-15',
				documentRevision: 4,
				totalGrossCents: 100,
				title: 'Oferta',
				categories: [{ id: 'cat', title: 'Usługi' }],
				items: [
					{
						id: 'item',
						name: 'Montaż',
						quantity: 1,
						unit: 'usł.',
						unitGrossCents: 100,
						totalGrossCents: 100,
						categoryId: 'cat'
					}
				]
			},
			7
		);

		expect(payload.expectedLockVersion).toBe(7);
		expect(payload).not.toHaveProperty('number');
		expect(payload).not.toHaveProperty('issuedAt');
		expect(payload).not.toHaveProperty('documentRevision');
		expect(payload).not.toHaveProperty('totalGrossCents');
		expect(payload.items?.[0]).not.toHaveProperty('totalGrossCents');
	});
});
