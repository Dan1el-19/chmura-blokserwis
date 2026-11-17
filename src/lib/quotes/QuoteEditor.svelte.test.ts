import { create } from '@bufbuild/protobuf';
import { Code, ConnectError } from '@connectrpc/connect';
import { beforeEach, expect, it, vi } from 'vitest';
import { render } from 'vitest-browser-svelte';
import { QuoteImportResultSchema, QuotePriceMode, QuoteSchema, QuoteVatKind } from '#lib/gen/unisource/v2/quotes_pb.js';
import QuoteEditor from './QuoteEditor.svelte';

const api = vi.hoisted(() => ({
	getQuote: vi.fn(), saveDraft: vi.fn(), approveQuote: vi.fn(), getImportResult: vi.fn(), getQuoteOperation: vi.fn(),
	getQuotePdf: vi.fn(), applyImport: vi.fn(), listQuoteRevisions: vi.fn(), remapQuoteImport: vi.fn(),
	getQuotePreview: vi.fn(), applyQuoteText: vi.fn(), generateDraftPdf: vi.fn(), saveQuoteWorkflow: vi.fn(), getQuoteConversation: vi.fn(), generateQuoteText: vi.fn(), uploadQuoteXlsx: vi.fn()
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
	api.getQuoteConversation.mockResolvedValue({ messages: [] });
	api.saveQuoteWorkflow.mockImplementation(async (request) => ({ workflow: { ...request.workflow, version: request.expectedVersion + 1n } }));
});

it.each([
	{ margin: '20mm 19mm 20mm', top: 76, left: 72 },
	{ margin: '18mm', top: 68, left: 68 }
])('previews A4 with the PDF margins from $margin and fits a narrow panel', async ({ margin, top, left }) => {
	api.getQuotePreview.mockResolvedValue({ html: `<!doctype html><html><head><style>
		@page{size:A4;margin:${margin};@bottom-left{content:"BLOKSERWIS"}}
		body{margin:0;font:9.5pt Arial}header{height:20mm}p{margin:0;height:10mm}
		</style></head><body><header>SZKIC</header>${'<p>Pozycja oferty</p>'.repeat(100)}<footer>Koniec oferty</footer></body></html>` });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByRole('button', { name: 'Pokaż podgląd wyceny' }).click();
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
	await view.getByRole('button', { name: '100%' }).click();
	const viewport = frame.parentElement!.parentElement!;
	await expect.poll(() => viewport.scrollWidth).toBeGreaterThan(viewport.clientWidth);
	await view.getByRole('button', { name: 'Dopasuj do szerokości' }).click();
	await expect.poll(() => viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth);
	const popup = { opener: window, document: document.implementation.createHTMLDocument('') };
	const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
	await view.getByRole('button', { name: 'Otwórz podgląd' }).click();
	expect(popup.opener).toBeNull();
	expect(popup.document.querySelector('iframe')?.getAttribute('sandbox')).toBe('');
	expect(popup.document.querySelector('iframe')?.srcdoc).toContain('SZKIC');
	open.mockRestore();
	doc.scrollingElement!.scrollTop = doc.scrollingElement!.scrollHeight;
	expect(doc.querySelector('footer')!.getBoundingClientRect().bottom).toBeLessThanOrEqual(frame.contentWindow!.innerHeight);
});

it('keeps typed values after a concurrent save conflict', async () => {
	api.saveDraft.mockRejectedValue(new ConnectError('draft changed', Code.Aborted));
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByLabelText('Tytuł').fill('Moja lokalna zmiana');
	await view.getByRole('button', { name: 'Zapisz szkic' }).first().click();
	await expect.element(view.getByRole('alert')).toHaveTextContent('Twoje zmiany pozostają w formularzu');
	await expect.element(view.getByText('Nie udało się zapisać', { exact: true }).last()).toBeVisible();
	await expect.element(view.getByLabelText('Tytuł')).toHaveValue('Moja lokalna zmiana');
	expect(api.saveDraft).toHaveBeenCalledWith(expect.objectContaining({
		expectedVersion: 1n, draft: expect.objectContaining({ title: 'Moja lokalna zmiana' })
	}));
});

it('reports a clean draft and allows retry after a save error', async () => {
	api.saveDraft.mockRejectedValueOnce(new Error('Brak połączenia'));
	api.saveDraft.mockResolvedValueOnce({ quote: original });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await expect.element(view.getByText('Zapisano', { exact: true }).last()).toBeVisible();
	await view.getByLabelText('Tytuł').fill('Zmiana');
	await expect.element(view.getByText('Niezapisane zmiany', { exact: true }).last()).toBeVisible();
	await view.getByRole('button', { name: 'Zapisz szkic' }).first().click();
	await expect.element(view.getByText('Nie udało się zapisać', { exact: true }).last()).toBeVisible();
	await view.getByRole('button', { name: 'Ponów zapis' }).first().click();
	await expect.element(view.getByText('Zapisano', { exact: true }).last()).toBeVisible();
});

it('does not report publication when the service returns no quote', async () => {
	api.approveQuote.mockResolvedValue({});
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByRole('button', { name: 'Zatwierdź wycenę' }).first().click();
	await expect.element(view.getByRole('alert')).toHaveTextContent('Nie otrzymano potwierdzenia zatwierdzenia wyceny.');
	await expect.element(view.getByText('Opublikowano rewizję.', { exact: true })).not.toBeInTheDocument();
});

it('saves newer edits after an earlier delayed save completes', async () => {
	let completeFirst!: (value: { quote: typeof original }) => void;
	api.saveDraft.mockImplementationOnce(() => new Promise((resolve) => { completeFirst = resolve; }));
	api.saveDraft.mockResolvedValue({ quote: create(QuoteSchema, {
		id: 'quote-1', draftVersion: 3n, draft: { title: 'Druga zmiana', priceMode: QuotePriceMode.GROSS }
	}) });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByLabelText('Tytuł').fill('Pierwsza zmiana');
	await view.getByRole('button', { name: 'Zapisz szkic' }).first().click();
	await expect.poll(() => api.saveDraft.mock.calls.length).toBe(1);
	await view.getByLabelText('Tytuł').fill('Druga zmiana');
	completeFirst({ quote: create(QuoteSchema, {
		id: 'quote-1', draftVersion: 2n, draft: { title: 'Pierwsza zmiana', priceMode: QuotePriceMode.GROSS }
	}) });
	await expect.poll(() => api.saveDraft.mock.calls.length).toBe(2);
	expect(api.saveDraft.mock.calls[1]?.[0]).toMatchObject({ expectedVersion: 2n, draft: { title: 'Druga zmiana' } });
	await expect.element(view.getByLabelText('Tytuł')).toHaveValue('Druga zmiana');
});

it('keeps the same editor and draft when switching to preview and back', async () => {
	api.getQuotePreview.mockResolvedValue({ html: '<html><body>Podgląd szkicu</body></html>' });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByLabelText('Tytuł').fill('Tekst zachowany');
	const input = view.getByLabelText('Tytuł').element();
	const showPreview = document.querySelector<HTMLButtonElement>('button[aria-label="Pokaż podgląd wyceny"]');
	expect(showPreview).not.toBeNull();
	showPreview!.click();
	await expect.poll(() => showPreview!.getAttribute('aria-pressed')).toBe('true');
	document.querySelector<HTMLButtonElement>('button[aria-label="Pokaż edycję wyceny"]')!.click();
	await expect.element(view.getByLabelText('Tytuł')).toHaveValue('Tekst zachowany');
	expect(view.getByLabelText('Tytuł').element()).toBe(input);
});

it('shows when the saved draft preview is still refreshing', async () => {
	let finishPreview!: (result: { html: string }) => void;
	api.getQuotePreview.mockResolvedValueOnce({ html: '<p>Poprzedni podgląd</p>' });
	api.getQuotePreview.mockImplementationOnce(() => new Promise((resolve) => { finishPreview = resolve; }));
	api.saveDraft.mockResolvedValue({ quote: create(QuoteSchema, {
		id: 'quote-1', draftVersion: 2n, draft: { title: 'Nowy szkic', priceMode: QuotePriceMode.GROSS }
	}) });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await expect.poll(() => api.getQuotePreview.mock.calls.length).toBe(1);
	await view.getByLabelText('Tytuł').fill('Nowy szkic');
	await view.getByRole('button', { name: 'Zapisz szkic' }).first().click();
	await expect.poll(() => api.getQuotePreview.mock.calls.length).toBe(2);
	await view.getByRole('button', {name:'Pokaż podgląd wyceny'}).click();
	await expect.element(view.getByText('Odświeżanie podglądu…')).toBeVisible();
	finishPreview({ html: '<p>Nowy podgląd</p>' });
	await expect.element(view.getByText('Odświeżanie podglądu…')).not.toBeInTheDocument();
});

it('opens a revision preview and ignores a late response after returning to the draft', async () => {
	let finishRevision!: (result: { html: string }) => void;
	api.getQuote.mockResolvedValue({ quote: create(QuoteSchema, {
		id: 'quote-1', draftVersion: 1n, currentRevision: 1n, draft: { title: 'Szkic', priceMode: QuotePriceMode.GROSS }
	}) });
	api.listQuoteRevisions.mockResolvedValue({ revisions: [{ revision: 1n, publishedAt: '2026-01-01T00:00:00Z' }] });
	api.getQuotePreview.mockImplementation(({ revision }: { revision: bigint }) => revision === 1n
		? new Promise((resolve) => { finishRevision = resolve; })
		: Promise.resolve({ html: '<p>Aktualny szkic</p>' }));
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await expect.poll(() => api.getQuotePreview.mock.calls.length).toBe(1);
	await view.getByRole('button', { name: 'Podgląd', exact: true }).click();
	const toggle = document.querySelector<HTMLButtonElement>('button[aria-label="Pokaż podgląd wyceny"]')!;
	await expect.poll(() => toggle.getAttribute('aria-pressed')).toBe('true');
	await view.getByRole('button', { name: 'Podgląd szkicu' }).last().click();
	await expect.poll(() => document.querySelector<HTMLIFrameElement>('iframe[title="Podgląd wyceny"]')?.srcdoc).toContain('Aktualny szkic');
	finishRevision({ html: '<p>Stara rewizja</p>' });
	await new Promise((resolve) => setTimeout(resolve, 0));
	await expect.poll(() => document.querySelector<HTMLIFrameElement>('iframe[title="Podgląd wyceny"]')?.srcdoc).toContain('Aktualny szkic');
	await expect.element(view.getByRole('heading', { name: 'Podgląd dokumentu · szkic' })).toBeVisible();
});

it('opens the draft preview from document actions', async () => {
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByRole('button', { name: 'Podgląd szkicu' }).click();
	const toggle = document.querySelector<HTMLButtonElement>('button[aria-label="Pokaż podgląd wyceny"]')!;
	await expect.poll(() => toggle.getAttribute('aria-pressed')).toBe('true');
});

it('retains the draft and previous preview when refreshing fails, and can retry', async () => {
	api.getQuotePreview.mockResolvedValueOnce({ html: '<p>Poprzedni podgląd</p>' });
	api.getQuotePreview.mockRejectedValueOnce(new Error('Brak połączenia'));
	api.getQuotePreview.mockResolvedValueOnce({ html: '<p>Odświeżony podgląd</p>' });
	api.saveDraft.mockResolvedValue({ quote: create(QuoteSchema, {
		id: 'quote-1', draftVersion: 2n, draft: { title: 'Moja oferta', priceMode: QuotePriceMode.GROSS }
	}) });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await expect.poll(() => api.getQuotePreview.mock.calls.length).toBe(1);
	await view.getByLabelText('Tytuł').fill('Moja oferta');
	await view.getByRole('button', { name: 'Zapisz szkic' }).first().click();
	await view.getByRole('button', {name:'Pokaż podgląd wyceny'}).click();
	await expect.element(view.getByText(/Nie udało się odświeżyć podglądu/)).toBeVisible();
	await expect.element(view.getByLabelText('Tytuł')).toHaveValue('Moja oferta');
	const frame = () => document.querySelector<HTMLIFrameElement>('iframe[title="Podgląd wyceny"]');
	await expect.poll(() => frame()?.srcdoc).toContain('Poprzedni podgląd');
	await view.getByRole('button', { name: 'Spróbuj ponownie' }).click();
	await expect.poll(() => frame()?.srcdoc).toContain('Odświeżony podgląd');
});

it('starts with import collapsed and allows opening its file controls', async () => {
	const view = await render(QuoteEditor, { id: 'quote-1' });
	const imported = view.getByRole('group', { name: 'Import XLSX' });
	await expect.element(imported.getByLabelText('Plik XLSX')).not.toBeVisible();
	await imported.getByText('Rozwiń import XLSX').click();
	await expect.element(imported.getByLabelText('Plik XLSX')).toBeVisible();
	const input = imported.getByLabelText('Plik XLSX').element() as HTMLInputElement;
	const files = new DataTransfer();
	files.items.add(new File(['fixture'], 'test.xlsx'));
	input.files = files.files;
	input.dispatchEvent(new Event('change', { bubbles: true }));
	await expect.element(imported.getByRole('button', { name: 'Prześlij arkusz' })).toBeVisible();
});

it('summarizes an applied import while its controls are collapsed', async () => {
	api.getImportResult.mockResolvedValue({ result: create(QuoteImportResultSchema, {
		id: 'import-applied', status: 'succeeded', applied: true
	}) });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	const imported = view.getByRole('group', { name: 'Import XLSX' });
	await expect.element(imported.getByText('Import zapisany w szkicu.')).toBeVisible();
	await expect.element(imported.getByLabelText('Plik XLSX')).not.toBeVisible();
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
	await imported.getByRole('button', { name: 'Edytuj pozycję 1: Kamera' }).click();
	await expect.element(imported.getByText(/Wiersz 8 w arkuszu/)).toBeVisible();
});

it('preserves the price mode of an existing net draft when saving edits', async () => {
	api.getQuote.mockResolvedValue({ quote: create(QuoteSchema, {
		id: 'quote-1', draftVersion: 1n, draft: { title: 'Wcześniejsza wycena', priceMode: QuotePriceMode.NET }
	}) });
	api.saveDraft.mockResolvedValue({ quote: original });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	await view.getByLabelText('Tytuł').fill('Zmieniona wycena');
	await view.getByRole('button', { name: 'Zapisz szkic' }).first().click();
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
	await view.getByRole('group', { name: 'Import XLSX' }).getByRole('button', { name: 'Edytuj pozycję 1: Kamera' }).click();
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
	await view.getByRole('group', { name: 'Import XLSX' }).getByRole('button', { name: 'Edytuj pozycję 1: Kamera' }).click();
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

it('opens and closes the desktop preview without discarding draft edits', async () => {
	api.getQuotePreview.mockResolvedValue({ html: '<p>Podgląd szkicu</p>' });
	const view = await render(QuoteEditor, { id: 'quote-1' });
	(view.container.querySelector('.quote-editor') as HTMLElement).style.width = '1200px';
	await view.getByLabelText('Tytuł').fill('Moja wycena');
	const toggle = view.getByRole('button', { name: 'Pokaż podgląd na desktopie' });
	await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
	await toggle.click();
	await expect.element(toggle).toHaveAttribute('aria-expanded', 'true');
	await toggle.click();
	await expect.element(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect.element(view.getByLabelText('Tytuł')).toHaveValue('Moja wycena');
});


it('edits the new document and explicitly applies an AI scope proposal', async () => {
 const draftQuote = create(QuoteSchema, { id:'quote-1', draftVersion:1n, draft:{title:'Nowa', client:'Klient', priceMode:QuotePriceMode.GROSS, documentSchemaVersion:2, documentDate:'2026-11-16', scopeSections:[{heading:'Obecny',body:'Ręczny tekst'}]} });
 api.getQuote.mockResolvedValue({quote:draftQuote});
 api.getQuoteOperation.mockResolvedValue({status:'succeeded',operationId:'op-1',draftVersion:1n,partialJson:'',researchStatus:'',searches:[],proposedScopeSections:[{heading:'Propozycja',body:'Nowy zakres'}]});
 api.applyQuoteText.mockResolvedValue({quote:create(QuoteSchema,{id:'quote-1',draftVersion:2n,draft:{title:'Nowa',client:'Klient',priceMode:QuotePriceMode.GROSS,documentSchemaVersion:2,documentDate:'2026-11-16',scopeSections:[{heading:'Propozycja',body:'Nowy zakres'}]}})});
 const view = await render(QuoteEditor,{id:'quote-1'});
 await expect.element(view.getByLabelText('Data dokumentu')).toHaveValue('2026-11-16');
 await expect.element(view.getByLabelText('Treść podsekcji 1')).toHaveValue('Ręczny tekst');
 await expect.element(view.getByText('Nowy zakres')).toBeVisible();
 await view.getByRole('button',{name:'Zastosuj zakres'}).click();
 expect(api.applyQuoteText).toHaveBeenCalledWith(expect.objectContaining({quoteId:'quote-1',operationId:'op-1',expectedVersion:1n}));
 await expect.element(view.getByLabelText('Treść podsekcji 1')).toHaveValue('Nowy zakres');
});

it('queues one PDF on opening and stops refreshing when the panel is closed', async () => {
 const quote = create(QuoteSchema,{id:'quote-1',draftVersion:1n,draft:{title:'Nowa',priceMode:QuotePriceMode.GROSS,documentSchemaVersion:2,documentDate:'2026-11-16',lines:[{name:'Kamera',quantity:'1',unitPrice:'10'}]}});
 api.getQuote.mockResolvedValue({quote});
 let generated = false;
 api.getQuotePdf.mockImplementation(async () => {
  if (!generated) throw new ConnectError('missing',Code.NotFound);
  return {status:'queued',revision:0n,draftVersion:1n,templateVersion:'4',url:''};
 });
 api.generateDraftPdf.mockImplementation(async () => { generated=true; return {quote}; });
 const view=await render(QuoteEditor,{id:'quote-1'});
 await expect.element(view.getByLabelText('Data dokumentu')).toBeVisible();
 expect(api.generateDraftPdf).not.toHaveBeenCalled();
 await view.getByRole('button',{name:'Podgląd szkicu'}).first().click();
 await expect.poll(() => api.generateDraftPdf.mock.calls.length).toBe(1);
 await expect.element(view.getByText('Przygotowywanie PDF…')).toBeVisible();
 await view.getByRole('button',{name:'Pokaż edycję wyceny'}).click();
 await new Promise(resolve => setTimeout(resolve,1700));
 expect(api.generateDraftPdf).toHaveBeenCalledTimes(1);
 expect(api.getQuotePreview).not.toHaveBeenCalled();
});

it('refreshes an expired PDF link without generating another document', async () => {
 const quote = create(QuoteSchema,{id:'quote-1',draftVersion:1n,draft:{title:'Nowa',priceMode:QuotePriceMode.GROSS,documentSchemaVersion:2,documentDate:'2026-11-16',lines:[{name:'Kamera',quantity:'1',unitPrice:'10'}]}});
 api.getQuote.mockResolvedValue({quote});
 api.getQuotePdf.mockResolvedValue({status:'succeeded',revision:0n,draftVersion:1n,templateVersion:'4',url:'https://storage.example/file'});
 const fetchMock=vi.fn().mockResolvedValueOnce(new Response('expired',{status:403})).mockResolvedValueOnce(new Response('%PDF-1.7\n',{status:200}));
 vi.stubGlobal('fetch',fetchMock);
 try {
  const view=await render(QuoteEditor,{id:'quote-1'});
  await view.getByRole('button',{name:'Podgląd szkicu'}).first().click();
  await expect.poll(() => fetchMock.mock.calls.length).toBe(2);
  expect(api.generateDraftPdf).not.toHaveBeenCalled();
  expect(api.getQuotePdf.mock.calls.length).toBeGreaterThanOrEqual(2);
 } finally { vi.unstubAllGlobals(); }
});

it('keeps a recoverable copy when loading the server version after a conflict', async () => {
 api.saveDraft.mockRejectedValue(new ConnectError('draft changed',Code.Aborted));
 api.getQuote.mockResolvedValueOnce({quote:original}).mockResolvedValueOnce({quote:create(QuoteSchema,{id:'quote-1',draftVersion:2n,draft:{title:'Wersja serwera',priceMode:QuotePriceMode.GROSS}})});
 const view=await render(QuoteEditor,{id:'quote-1'});
 await view.getByLabelText('Tytuł').fill('Moja wersja');
 await view.getByRole('button',{name:'Zapisz szkic'}).first().click();
 await view.getByRole('button',{name:'Wczytaj wersję serwera'}).click();
 await expect.element(view.getByLabelText('Tytuł')).toHaveValue('Wersja serwera');
 await expect.element(view.getByLabelText('Odzyskane zmiany')).toHaveValue(expect.stringContaining('Moja wersja'));
});

it('shows a read-only wizard review before collecting document details', async()=>{
 api.getQuote.mockResolvedValue({quote:create(QuoteSchema,{id:'quote-1',draftVersion:1n,draft:{title:'Drużynowa',client:'Dom dziecka',documentSchemaVersion:2,documentDate:'2026-11-16',lines:[{name:'Zwora 600 SL',quantity:'1',unitPrice:'330'}]}})});
 const view=await render(QuoteEditor,{id:'quote-1',wizardMode:{stage:'review',editing:false,onstagechange:vi.fn(),onstatechange:vi.fn()}});
 await expect.element(view.getByText('Zwora 600 SL',{exact:true})).toBeVisible();
 await expect.element(view.getByRole('button',{name:'Dalej: dane wyceny'})).toBeVisible();
 await expect.element(view.getByLabelText('Nazwa pozycji 1')).not.toBeInTheDocument();
 expect(api.generateDraftPdf).not.toHaveBeenCalled();
});
it('does not allow publishing before the current PDF has been displayed in the wizard',async()=>{
 api.getQuote.mockResolvedValue({quote:create(QuoteSchema,{id:'quote-1',draftVersion:1n,draft:{title:'Drużynowa',client:'Dom dziecka',documentSchemaVersion:2,documentDate:'2026-11-16',lines:[{name:'Zwora',quantity:'1',unitPrice:'330'}]}})});
 const view=await render(QuoteEditor,{id:'quote-1',wizardMode:{stage:'preview',editing:false,onstagechange:vi.fn(),onstatechange:vi.fn()}});
 await expect.element(view.getByRole('button',{name:'Zatwierdź wycenę',exact:true})).toBeDisabled();
 expect(api.approveQuote).not.toHaveBeenCalled();
});


const wizardQuote = () => create(QuoteSchema, { id: 'quote-1', draftVersion: 1n, draft: { title: 'Kontrola dostępu', client: 'Klient', documentSchemaVersion: 2, documentDate: '2026-11-16', lines: [{ name: 'Zwora', quantity: '1', unitPrice: '330' }] } });

it('does not spend an AI call when saving the workflow choice fails', async () => {
 api.getQuote.mockResolvedValue({ quote: wizardQuote() });
 api.saveQuoteWorkflow.mockRejectedValue(new ConnectError('Brak dostępu do wyceny', Code.PermissionDenied));
 const onstagechange = vi.fn();
 const view = await render(QuoteEditor, { id: 'quote-1', wizardMode: { stage: 'details', editing: false, onstagechange, onstatechange: vi.fn() } });
 await view.getByRole('button', { name: 'Tak, przygotuj opisy' }).click();
 await expect.element(view.getByRole('alert')).toBeVisible();
 expect(api.generateQuoteText).not.toHaveBeenCalled();
 expect(onstagechange).not.toHaveBeenCalled();
});

it('restores the saved agent stage before persisting a default review stage', async () => {
 const quote = wizardQuote();
 quote.workflow = { $typeName: 'unisource.v2.QuoteWorkflowState', stage: 'agent', aiChoice: 'yes', version: 7n };
 api.getQuote.mockResolvedValue({ quote });
 const onstagechange = vi.fn();
 await render(QuoteEditor, { id: 'quote-1', wizardMode: { stage: 'review', editing: false, resume: true, onstagechange, onstatechange: vi.fn() } });
 await expect.poll(() => onstagechange.mock.calls[0]?.[0]).toBe('agent');
 expect(api.saveQuoteWorkflow).not.toHaveBeenCalled();
 expect(api.generateQuoteText).not.toHaveBeenCalled();
});

it('reconciles a committed workflow after a lost response and waits for explicit retry', async () => {
 const quote = wizardQuote();
 api.getQuote.mockResolvedValue({ quote });
 api.saveQuoteWorkflow.mockImplementation(async (request) => {
  if (request.workflow.stage === 'review') return { workflow: { ...request.workflow, version: 1n } };
  if (request.expectedVersion < 2n) {
   quote.workflow = { $typeName: 'unisource.v2.QuoteWorkflowState', stage: 'agent', aiChoice: 'yes', version: 2n };
   throw new ConnectError('Utracono potwierdzenie zapisu', Code.Unavailable);
  }
  return { workflow: { ...request.workflow, version: request.expectedVersion + 1n } };
 });
 api.generateQuoteText.mockResolvedValue({ operationId: 'op-retry' });
 const onstagechange = vi.fn();
 const view = await render(QuoteEditor, { id: 'quote-1', wizardMode: { stage: 'details', editing: false, onstagechange, onstatechange: vi.fn() } });
 await view.getByRole('button', { name: 'Tak, przygotuj opisy' }).click();
 await expect.element(view.getByRole('alert')).toBeVisible();
 expect(api.generateQuoteText).not.toHaveBeenCalled();
 expect(onstagechange).not.toHaveBeenCalled();
 await view.getByRole('button', { name: 'Tak, przygotuj opisy' }).click();
 await expect.poll(() => api.generateQuoteText.mock.calls.length).toBe(1);
 expect(onstagechange).toHaveBeenCalledWith('agent', false);
});

it('takes reviewed positions to a dedicated document details step without validation errors',async()=>{
 const quote=wizardQuote();quote.draft!.client='';
 api.getQuote.mockResolvedValue({quote});
 const onstagechange=vi.fn();
 const view=await render(QuoteEditor,{id:'quote-1',wizardMode:{stage:'review',editing:false,onstagechange,onstatechange:vi.fn()}});
 await view.getByRole('button',{name:'Dalej: dane wyceny'}).click();
 await expect.poll(()=>onstagechange.mock.calls.at(-1)).toEqual(['details',false]);
 expect(api.generateQuoteText).not.toHaveBeenCalled();
 await expect.element(view.getByRole('alert')).not.toBeInTheDocument();
});

it('saves reviewed import edits before navigating back to upload',async()=>{
 const quote=wizardQuote();api.getQuote.mockResolvedValue({quote});
 const imported=create(QuoteImportResultSchema,{id:'import-edited',status:'succeeded',resultVersion:1n,lines:[{sourceRow:2,line:{name:'Zwora',quantity:'1',unitPrice:'330'}}]});
 api.getImportResult.mockImplementation(async()=>({result:{...imported,applied:api.applyImport.mock.calls.length>0}}));
 api.applyImport.mockResolvedValue({quote:create(QuoteSchema,{...quote,draftVersion:2n})});
 const states: {navigate?: (stage:'import')=>Promise<boolean>}[]=[];
 const onstagechange=vi.fn();
 const view=await render(QuoteEditor,{id:'quote-1',wizardMode:{stage:'review',editing:true,onstagechange,onstatechange:state=>states.push(state)}});
 await view.getByRole('button',{name:'Edytuj pozycję 1: Zwora'}).click();
 await view.getByLabelText('Nazwa pozycji 1').fill('Zwora poprawiona');
 await states.at(-1)!.navigate!('import');
 expect(api.applyImport).toHaveBeenCalledWith(expect.objectContaining({reviewedLines:[expect.objectContaining({name:'Zwora poprawiona'})]}));
 expect(onstagechange).toHaveBeenCalledWith('import',false);
});

it('prefetches the completed AI proposal without applying it to the draft',async()=>{
 const quote=wizardQuote();api.getQuote.mockResolvedValue({quote});
 api.getQuoteOperation.mockResolvedValue({operationId:'ai-proposal',draftVersion:1n,status:'succeeded',partialText:'Gotowe',partialJson:'',events:[],searches:[],proposedScopeSections:[],proposedLineTexts:[{lineIndex:0,name:'Zwora',description:'Nowy opis'}]});
 api.getQuotePdf.mockImplementation(async(request)=>request.proposalOperationId?{status:'succeeded',url:'https://pdf.example/proposal.pdf',draftVersion:1n,revision:0n,templateVersion:'4',proposalOperationId:'ai-proposal'}:Promise.reject(new ConnectError('missing',Code.NotFound)));
 const fetchMock=vi.fn().mockResolvedValue(new Response('%PDF-1.7\n',{status:200}));vi.stubGlobal('fetch',fetchMock);
 try {
  await render(QuoteEditor,{id:'quote-1',wizardMode:{stage:'agent',editing:false,onstagechange:vi.fn(),onstatechange:vi.fn()}});
  await expect.poll(()=>fetchMock.mock.calls.some(call=>call[0]==='https://pdf.example/proposal.pdf')).toBe(true);
  expect(api.applyQuoteText).not.toHaveBeenCalled();
  expect(quote.draft!.lines[0].description).toBe('');
 } finally {vi.unstubAllGlobals();}
});

it('explains missing required document data on the details screen',async()=>{
 const quote=wizardQuote();quote.draft!.client='';api.getQuote.mockResolvedValue({quote});
 const onstagechange=vi.fn();
 const view=await render(QuoteEditor,{id:'quote-1',wizardMode:{stage:'details',editing:false,onstagechange,onstatechange:vi.fn()}});
 await view.getByRole('button',{name:'Kontynuuj bez AI'}).click();
 await expect.element(view.getByRole('alert')).toHaveTextContent('Uzupełnij nazwę wyceny, klienta i datę.');
 await expect.element(view.getByLabelText('Klient')).toHaveAttribute('aria-invalid','true');
 expect(api.generateQuoteText).not.toHaveBeenCalled();
 expect(onstagechange).not.toHaveBeenCalled();
});

it('lets the user return to upload after reviewing a completed import',async()=>{
 const quote=wizardQuote();api.getQuote.mockResolvedValue({quote});
 api.getImportResult.mockResolvedValue({result:create(QuoteImportResultSchema,{id:'import-back',status:'succeeded',resultVersion:1n,lines:[{sourceRow:2,line:{name:'Zwora',quantity:'1',unitPrice:'330'}}]})});
 const states:{navigate?:(stage:'import')=>Promise<boolean>}[]=[];const onstagechange=vi.fn();
 const wizardMode={stage:'review' as const,editing:false,onstagechange,onstatechange:(state:typeof states[number])=>states.push(state)};
 const view=await render(QuoteEditor,{id:'quote-1',wizardMode});
 await expect.element(view.getByText('Zwora',{exact:true})).toBeVisible();
 await view.rerender({id:'quote-1',wizardMode:{...wizardMode,stage:'import'}});
 await states.at(-1)!.navigate!('import');
 expect(onstagechange.mock.calls.some(call=>call[0]==='review')).toBe(false);
});
