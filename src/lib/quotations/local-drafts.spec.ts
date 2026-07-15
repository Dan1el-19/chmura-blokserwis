import { describe, expect, it } from 'vitest';
import {
	LOCAL_QUOTATION_DRAFTS_KEY,
	createLocalQuotationDraft,
	listLocalQuotationDrafts,
	migrateLocalQuotationDrafts,
	removeLocalQuotationDraft,
	saveLocalQuotationDraft
} from './local-drafts';

function memoryStorage(initial: Record<string, string> = {}) {
	const values = new Map(Object.entries(initial));
	return {
		getItem: (key: string) => values.get(key) ?? null,
		setItem: (key: string, value: string) => values.set(key, value)
	};
}

describe('local quotation drafts', () => {
	it('creates a draft and recalculates its total from items', () => {
		const draft = createLocalQuotationDraft({
			id: 'draft-1',
			now: '2026-07-15T10:00:00.000Z',
			title: '  Monitoring obiektu  ',
			items: [
				{
					id: 'item-1',
					name: 'Kamera',
					quantity: 2,
					unit: 'szt.',
					unitGrossCents: 10000,
					totalGrossCents: 20000,
					sortOrder: 0,
					sourceRowNumber: 2
				}
			]
		});

		expect(draft).toMatchObject({
			id: 'draft-1',
			title: 'Monitoring obiektu',
			totalGrossCents: 20000,
			status: 'draft'
		});
	});

	it('persists, replaces and sorts drafts by update time', () => {
		const storage = memoryStorage();
		const older = createLocalQuotationDraft({
			id: 'older',
			now: '2026-07-14T10:00:00.000Z',
			title: 'Starsza',
			items: []
		});
		const newer = createLocalQuotationDraft({
			id: 'newer',
			now: '2026-07-15T10:00:00.000Z',
			title: 'Nowsza',
			items: []
		});

		saveLocalQuotationDraft(storage, older);
		saveLocalQuotationDraft(storage, newer);
		saveLocalQuotationDraft(storage, { ...older, title: 'Zmieniona' });

		expect(listLocalQuotationDrafts(storage).map(({ id, title }) => ({ id, title }))).toEqual([
			{ id: 'newer', title: 'Nowsza' },
			{ id: 'older', title: 'Zmieniona' }
		]);
	});

	it('ignores malformed local data', () => {
		const storage = memoryStorage({ [LOCAL_QUOTATION_DRAFTS_KEY]: '{invalid' });
		expect(listLocalQuotationDrafts(storage)).toEqual([]);
	});

	it('removes only the selected local draft', () => {
		const storage = memoryStorage();
		const first = createLocalQuotationDraft({ id: 'first', title: 'A', items: [] });
		const second = createLocalQuotationDraft({ id: 'second', title: 'B', items: [] });
		saveLocalQuotationDraft(storage, first);
		saveLocalQuotationDraft(storage, second);

		removeLocalQuotationDraft(storage, first.id);
		expect(listLocalQuotationDrafts(storage).map((draft) => draft.id)).toEqual(['second']);
	});

	it('deletes a local draft only after confirmed remote creation', async () => {
		const storage = memoryStorage();
		const successful = createLocalQuotationDraft({
			id: 'success',
			title: 'Sukces',
			items: [sampleItem('success-item')]
		});
		const failed = createLocalQuotationDraft({
			id: 'failed',
			title: 'Błąd',
			items: [sampleItem('failed-item')]
		});
		saveLocalQuotationDraft(storage, successful);
		saveLocalQuotationDraft(storage, failed);

		const result = await migrateLocalQuotationDrafts(storage, async (payload, draft) => {
			expect(payload.items[0]).not.toHaveProperty('totalGrossCents');
			if (draft.id === 'failed') throw new Error('remote failed');
			return { id: `remote-${draft.id}` };
		});

		expect(result.migrated.map(({ draft }) => draft.id)).toEqual(['success']);
		expect(result.failed.map(({ draft }) => draft.id)).toEqual(['failed']);
		expect(listLocalQuotationDrafts(storage).map((draft) => draft.id)).toEqual(['failed']);
	});

	it('keeps the draft while the remote request is still pending', async () => {
		const storage = memoryStorage();
		const draft = createLocalQuotationDraft({
			id: 'pending',
			title: 'Oczekująca',
			items: [sampleItem('item')]
		});
		saveLocalQuotationDraft(storage, draft);

		let confirm!: () => void;
		const pending = migrateLocalQuotationDrafts(
			storage,
			() =>
				new Promise<{ id: string }>((resolve) => {
					confirm = () => resolve({ id: 'remote' });
				})
		);
		await Promise.resolve();
		expect(listLocalQuotationDrafts(storage)).toHaveLength(1);
		confirm();
		await pending;
		expect(listLocalQuotationDrafts(storage)).toHaveLength(0);
	});
});

function sampleItem(id: string) {
	return {
		id,
		name: 'Pozycja',
		quantity: 1,
		unit: 'szt.',
		unitGrossCents: 100,
		totalGrossCents: 100,
		sortOrder: 0,
		sourceRowNumber: 2
	};
}
