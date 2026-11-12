import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { QuoteImportResultSchema, QuotePriceMode, QuoteSchema, QuoteVatKind } from '#lib/gen/unisource/v2/quotes_pb.js';
import QuoteEditor from './QuoteEditor.svelte';

const api = vi.hoisted(() => ({
	getQuote: vi.fn(), saveDraft: vi.fn(), getImportResult: vi.fn(), getQuoteOperation: vi.fn(),
	getQuotePdf: vi.fn(), applyImport: vi.fn(), listQuoteRevisions: vi.fn(), remapQuoteImport: vi.fn(),
	getQuotePreview: vi.fn()
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
	api.getQuotePreview.mockResolvedValue({ html: '' });
});

it.each([
	{ margin: '20mm 19mm 20mm', top: 76, left: 72 },
	{ margin: '18mm', top: 68, left: 68 }
])('previews A4 with the PDF margins from $margin and fits a narrow panel', async ({ margin, top, left }) => {
	api.getQuotePreview.mockResolvedValue({ html: `<!doctype html><html><head><style>
		@page{size:A4;margin:${margin};@bottom-left{content:"BLOKSERWIS"}}
		body{margin:0;font:9.5pt Arial}header{height:20mm}p{margin:0;height:10mm}
		</style></head><body><header>SZKIC</header>${'<p>Pozycja oferty</p>'.repeat(100)}<footer>Koniec oferty</footer></body></html>` });
	await render(QuoteEditor, { id: 'quote-1' });
	await expect.poll(() => document.querySelector('iframe[title="Podgląd wyceny"]')).not.toBeNull();
	const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Podgląd wyceny"]')!;
	expect(frame.getAttribute('sandbox')).toBe('');
	// Inspect layout in the test only; production keeps the opaque sandbox origin.
	frame.removeAttribute('sandbox');
	frame.srcdoc += ' ';
	await expect.poll(() => frame.contentDocument?.querySelector('header')?.textContent).toBe('SZKIC');
	const doc = frame.contentDocument!;
	const style = frame.contentWindow!.getComputedStyle(doc.body);
	expect(Math.round(parseFloat(style.paddingTop))).toBe(top);
	expect(Math.round(parseFloat(style.paddingLeft))).toBe(left);
	expect(Math.round(doc.body.getBoundingClientRect().width)).toBe(794);
	expect(doc.scrollingElement!.scrollHeight).toBeGreaterThan(doc.scrollingElement!.clientHeight);
	const aside = frame.closest('aside')!;
	aside.style.width = '320px';
	await expect.poll(() => frame.getBoundingClientRect().width).toBeLessThanOrEqual(320);
	expect(Math.round(doc.body.getBoundingClientRect().width)).toBe(794);
	expect(doc.scrollingElement!.scrollWidth).toBeLessThanOrEqual(doc.scrollingElement!.clientWidth);
	doc.scrollingElement!.scrollTop = doc.scrollingElement!.scrollHeight;
	expect(doc.querySelector('footer')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(frame.contentWindow!.innerHeight);
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

it('saves newer edits after an earlier delayed save completes', async () => {
	let completeFirst!: (value: { quote: typeof original }) => void;
	api.saveDraft.mockImplementationOnce(() => new Promise((resolve) => { completeFirst = resolve; }));
	api.saveDraft.mockResolvedValue({ quote: create(QuoteSchema, {
		id: 'quote-1', draftVersion: 3n, draft: { title: 'Druga zmiana', priceMode: QuotePriceMode.GROSS }
	}) });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByLabelText('Tytuł').fill('Pierwsza zmiana');
	await view.getByRole('button', { name: 'Zapisz szkic' }).click();
	await expect.poll(() => api.saveDraft.mock.calls.length).toBe(1);
	await view.getByLabelText('Tytuł').fill('Druga zmiana');
	completeFirst({ quote: create(QuoteSchema, {
		id: 'quote-1', draftVersion: 2n, draft: { title: 'Pierwsza zmiana', priceMode: QuotePriceMode.GROSS }
	}) });
	await expect.poll(() => api.saveDraft.mock.calls.length).toBe(2);
	expect(api.saveDraft.mock.calls[1]?.[0]).toMatchObject({ expectedVersion: 2n, draft: { title: 'Druga zmiana' } });
	await expect.element(view.getByLabelText('Tytuł')).toHaveValue('Druga zmiana');
});

it('applies imported prices as gross even when the detected mapping says net', async () => {
	api.getImportResult.mockResolvedValue({ result: create(QuoteImportResultSchema, {
		id: 'import-net', status: 'succeeded', resultVersion: 1n,
		mapping: { priceMode: QuotePriceMode.NET },
		lines: [{ sourceRow: 2, line: { name: 'Kamera', quantity: '1', unitPrice: '100' } }]
	}) });
	api.applyImport.mockResolvedValue({ quote: original });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByRole('button', { name: 'Zastosuj sprawdzone pozycje' }).click();
	await expect.poll(() => api.applyImport.mock.calls.length).toBe(1);
	expect(api.applyImport).toHaveBeenCalledWith(expect.objectContaining({ priceMode: QuotePriceMode.GROSS }));
});

it('keeps imported source rows aligned when a result has no line', async () => {
	api.getImportResult.mockResolvedValue({ result: create(QuoteImportResultSchema, {
		id: 'import-rows', status: 'succeeded', resultVersion: 1n,
		lines: [{ sourceRow: 3 }, { sourceRow: 8, line: { name: 'Kamera', quantity: '1', unitPrice: '100' } }]
	}) });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	const imported = view.getByRole('group', { name: 'Import XLSX' });
	await expect.element(imported.getByLabelText('Nazwa pozycji 1')).toHaveValue('Kamera');
	await expect.element(imported.getByText(/Wiersz 8 w arkuszu/)).toBeVisible();
});

it('preserves the price mode of an existing net draft when saving edits', async () => {
	api.getQuote.mockResolvedValue({ quote: create(QuoteSchema, {
		id: 'quote-1', draftVersion: 1n, draft: { title: 'Wcześniejsza wycena', priceMode: QuotePriceMode.NET }
	}) });
	api.saveDraft.mockResolvedValue({ quote: original });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByLabelText('Tytuł').fill('Zmieniona wycena');
	await view.getByRole('button', { name: 'Zapisz szkic' }).click();
	await expect.poll(() => api.saveDraft.mock.calls.length).toBe(1);
	expect(api.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
		draft: expect.objectContaining({ priceMode: QuotePriceMode.NET })
	}));
});

it('recovers an import and applies edited gross prices without inventing VAT', async () => {
	api.getImportResult.mockResolvedValue({ result: create(QuoteImportResultSchema, {
		id: 'import-1', status: 'succeeded', resultVersion: 22n, baseTotal: '40.00',
		lines: [{ sourceRow: 2, line: { name: 'Kamera', quantity: '2', unitPrice: '20' } }]
	}) });
	api.applyImport.mockResolvedValue({ quote: create(QuoteSchema, {
		id: 'quote-1', draftVersion: 2n, draft: { title: 'Pierwotny szkic', priceMode: QuotePriceMode.GROSS }
	}) });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByRole('group', { name: 'Import XLSX' }).getByLabelText('Cena brutto pozycji 1').fill('21');
	await view.getByRole('button', { name: 'Zastosuj sprawdzone pozycje' }).click();
	await expect.poll(() => api.applyImport.mock.calls.length).toBe(1);
	expect(api.applyImport).toHaveBeenCalledWith(expect.objectContaining({
		importId: 'import-1', resultVersion: 22n, expectedVersion: 1n,
		priceMode: QuotePriceMode.GROSS, reviewedLines: [expect.objectContaining({ unitPrice: '21', vatKind: QuoteVatKind.UNSPECIFIED, vatPercent: '' })]
	}));
});

it('shows all import warnings and the source row', async () => {
	api.getImportResult.mockResolvedValue({ result: create(QuoteImportResultSchema, {
		id: 'import-1', status: 'succeeded', resultVersion: 1n, baseTotal: '40.00',
		warnings: ['source_total_mismatch', 'other_warning'],
		lines: [{ sourceRow: 4, line: { name: 'Kamera', quantity: '2', unitPrice: '20' } }]
	}) });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await expect.element(view.getByText('other_warning')).toBeVisible();
	await expect.element(view.getByText(/Wiersz 4/)).toBeVisible();
});

it('shows the PDF state for each published revision', async () => {
	api.getQuote.mockResolvedValue({ quote: create(QuoteSchema, {
		id: 'quote-1', draftVersion: 1n, currentRevision: 2n,
		draft: { title: 'Oferta', priceMode: QuotePriceMode.GROSS }
	}) });
	api.listQuoteRevisions.mockResolvedValue({ revisions: [
		{ revision: 2n, publishedAt: '2026-01-01T00:00:00Z' },
		{ revision: 1n, publishedAt: '2026-01-01T00:00:00Z' }
	] });
	api.getQuotePdf.mockImplementation(async ({ revision }: { revision?: bigint }) => ({
		status: revision === 2n ? 'failed' : 'succeeded', revision: revision ?? 1n
	}));
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await expect.element(view.getByText('PDF: błąd')).toBeVisible();
	await expect.element(view.getByText('PDF: gotowy')).toBeVisible();
});


it('reuses a remap key on retry but assigns a new key after changing the mapping', async () => {
	api.getImportResult.mockResolvedValue({ result: create(QuoteImportResultSchema, {
		id: 'import-1', status: 'failed', resultVersion: 1n
	}) });
	api.remapQuoteImport.mockRejectedValue(new ConnectError('unavailable', Code.Unavailable));
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByText('Ręczne mapowanie').click();
	const remap = view.getByRole('button', { name: 'Przelicz mapowanie' });
	await remap.click();
	await expect.poll(() => api.remapQuoteImport.mock.calls.length).toBe(1);
	await remap.click();
	await expect.poll(() => api.remapQuoteImport.mock.calls.length).toBe(2);
	const first = api.remapQuoteImport.mock.calls[0][0].idempotencyKey;
	expect(api.remapQuoteImport.mock.calls[1][0].idempotencyKey).toBe(first);
	await view.getByLabelText('Arkusz', { exact: true }).fill('Arkusz1');
	await remap.click();
	await expect.poll(() => api.remapQuoteImport.mock.calls.length).toBe(3);
	expect(api.remapQuoteImport.mock.calls[2][0].idempotencyKey).not.toBe(first);
});

it('does not offer an outdated draft PDF after editing the draft', async () => {
	api.getQuotePdf.mockResolvedValue({ status: 'succeeded', draftVersion: 1n, url: 'https://example.test/draft.pdf' });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await expect.element(view.getByRole('button', { name: 'Pobierz PDF szkicu' })).toBeVisible();
	await view.getByLabelText('Tytuł').fill('Nowa treść');
	await expect.element(view.getByRole('button', { name: 'Pobierz PDF szkicu' })).not.toBeInTheDocument();
});
