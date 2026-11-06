import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { QuoteImportResultSchema, QuotePriceMode, QuoteSchema, QuoteVatKind } from '#lib/gen/unisource/v2/quotes_pb.js';
import QuoteEditor from './QuoteEditor.svelte';

const api = vi.hoisted(() => ({
	getQuote: vi.fn(), saveDraft: vi.fn(), getImportResult: vi.fn(), getQuoteOperation: vi.fn(),
	getQuotePdf: vi.fn(), applyImport: vi.fn()
}));
vi.mock('#lib/api.js', () => ({ getQuoteClient: () => api }));
vi.mock('$app/navigation', () => ({ beforeNavigate: vi.fn() }));
vi.mock('$app/paths', () => ({ resolve: (path: string) => path }));

const original = create(QuoteSchema, {
	id: 'quote-1', draftVersion: 1n, draft: { title: 'Pierwotny szkic', priceMode: QuotePriceMode.GROSS }
});

beforeEach(() => {
	vi.resetAllMocks();
	api.getQuote.mockResolvedValue({ quote: original });
	const missing = new ConnectError('missing', Code.NotFound);
	api.getImportResult.mockRejectedValue(missing);
	api.getQuoteOperation.mockRejectedValue(missing);
	api.getQuotePdf.mockRejectedValue(missing);
});

it('keeps typed values after a concurrent save conflict', async () => {
	api.saveDraft.mockRejectedValue(new ConnectError('draft changed', Code.Aborted));
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByLabelText('Tytuł').fill('Moja lokalna zmiana');
	await view.getByRole('button', { name: 'Zapisz szkic' }).click();
	await expect.element(view.getByRole('alert')).toHaveTextContent('Twoje zmiany pozostają w formularzu');
	await expect.element(view.getByLabelText('Tytuł')).toHaveValue('Moja lokalna zmiana');
	expect(api.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
		expectedVersion: 1n, draft: expect.objectContaining({ title: 'Moja lokalna zmiana' })
	}));
});

it('recovers an import after opening the editor and applies the reviewed VAT', async () => {
	api.getImportResult.mockResolvedValue({ result: create(QuoteImportResultSchema, {
		id: 'import-1', status: 'succeeded', resultVersion: 22n, baseTotal: '40.00',
		lines: [{ sourceRow: 2, line: { name: 'Kamera', quantity: '2', unitPrice: '20' } }]
	}) });
	api.applyImport.mockResolvedValue({ quote: create(QuoteSchema, {
		id: 'quote-1', draftVersion: 2n, draft: { title: 'Pierwotny szkic', priceMode: QuotePriceMode.GROSS }
	}) });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByRole('group', { name: 'Import XLSX' }).getByRole('button', { name: 'Zaznacz wszystkie' }).click();
	await view.getByRole('group', { name: 'Import XLSX' }).getByRole('button', { name: 'Ustaw VAT zaznaczonym' }).click();
	await view.getByRole('button', { name: 'Zastosuj sprawdzone pozycje' }).click();
	await expect.poll(() => api.applyImport.mock.calls.length).toBe(1);
	expect(api.applyImport).toHaveBeenCalledWith(expect.objectContaining({
		importId: 'import-1', resultVersion: 22n, expectedVersion: 1n,
		reviewedLines: [expect.objectContaining({ vatKind: QuoteVatKind.RATE, vatPercent: '23' })]
	}));
});
