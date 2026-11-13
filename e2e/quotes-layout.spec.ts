import { create, fromBinary, toBinary } from '@bufbuild/protobuf';
import { expect, test } from 'playwright/test';
import {
	GetQuotePreviewResponseSchema, GetQuoteResponseSchema, QuotePriceMode, QuoteSchema,
	ListQuotesResponseSchema, SaveDraftRequestSchema, SaveDraftResponseSchema
} from '../src/lib/gen/unisource/v2/quotes_pb.js';

for (const width of [320, 390]) {
	test(`edits and previews an A4 quote at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 844 });
		await page.addInitScript(() => Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: { user: { id: 'quote-user' }, session: { id: 'quote-session', status: 'active', getToken: async () => 'token' }, load: async () => {}, addListener: () => () => {}, signOut: async () => {} }
		}));
		await page.route('http://localhost:8787/**', async (route) => {
			const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
			if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
			const method = route.request().url().split('/').at(-1);
			return route.fulfill({ status: 200, headers, json: method === 'GetSpaces' ? { spaces: [{ id: 'personal', kind: 2 }] } : {} });
		});
		let quote = create(QuoteSchema, { id: 'layout-quote', draftVersion: 1n, draft: {
			title: 'Testowa wycena', priceMode: QuotePriceMode.GROSS,
			lines: [{ name: 'Kamera', quantity: '2', unitPrice: '20' }]
		} });
		await page.route('http://localhost:8788/**', async (route) => {
			const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
			if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
			const method = route.request().url().split('/').at(-1);
			let body: Uint8Array;
			if (method === 'GetQuote') body = toBinary(GetQuoteResponseSchema, create(GetQuoteResponseSchema, { quote }));
			else if (method === 'SaveDraft') {
				const request = fromBinary(SaveDraftRequestSchema, route.request().postDataBuffer()!);
				quote = create(QuoteSchema, { ...quote, draftVersion: quote.draftVersion + 1n, draft: request.draft });
				body = toBinary(SaveDraftResponseSchema, create(SaveDraftResponseSchema, { quote }));
			} else if (method === 'GetQuotePreview') body = toBinary(GetQuotePreviewResponseSchema, create(GetQuotePreviewResponseSchema, {
				html: '<html><head><style>@page{size:A4;margin:18mm}body{margin:0}table{width:100%}</style></head><body><h1>SZKIC</h1><table><tr><td>Pozycja</td><td id="total">40,00 zł</td></tr></table></body></html>'
			}));
			else return route.fulfill({ status: 404, headers: { ...headers, 'content-type': 'application/json' }, json: { code: 'not_found', message: 'Brak danych' } });
			return route.fulfill({ status: 200, headers: { ...headers, 'content-type': 'application/proto' }, body: Buffer.from(body) });
		});
		await page.goto('/wyceny/layout-quote');
		const title = page.getByLabel('Tytuł');
		await title.fill('Zmieniony szkic');
		const actionBar = page.getByRole('region', { name: 'Zapis wyceny' });
		await expect(actionBar).toBeInViewport();
		await expect(actionBar.getByRole('button', { name: 'Zapisz szkic' })).toBeVisible();
		await expect(actionBar.getByRole('button', { name: 'Zatwierdź wycenę' })).toBeVisible();
		const scrollHost = page.locator('#main-content');
		await scrollHost.evaluate((element) => { element.scrollTop = element.scrollHeight / 2; });
		await expect(actionBar).toBeInViewport();
		const introduction = page.getByLabel('Wstęp');
		await introduction.focus();
		await expect.poll(async () => {
			const field = await introduction.boundingBox();
			const bar = await actionBar.boundingBox();
			return !!field && !!bar && field.y + field.height <= bar.y;
		}).toBe(true);
		const line = page.getByText('Pozycja 1', { exact: true }).locator('..').locator('..');
		const lineBox = await line.boundingBox();
		expect(lineBox?.height).toBeLessThanOrEqual(200);
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await expect.poll(() => page.locator('#main-content').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
		await page.getByRole('button', { name: 'Pokaż podgląd wyceny' }).click();
		await expect(title).toBeHidden();
		const frame = page.frameLocator('iframe[title="Podgląd wyceny"]');
		await expect(frame.getByText('40,00 zł')).toBeVisible();
		const iframe = page.locator('iframe[title="Podgląd wyceny"]');
		await expect(iframe).toHaveAttribute('sandbox', '');
		const rightColumn = await frame.getByText('40,00 zł').boundingBox();
		const frameBox = await iframe.boundingBox();
		expect(rightColumn && frameBox && rightColumn.x + rightColumn.width <= frameBox.x + frameBox.width + 1).toBe(true);
		await page.getByRole('button', { name: '100%' }).click();
		const viewport = page.locator('.preview-viewport');
		await expect.poll(() => viewport.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
		await page.getByRole('button', { name: 'Dopasuj do szerokości' }).click();
		await expect.poll(() => viewport.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
		const popupPromise = page.waitForEvent('popup');
		await page.getByRole('button', { name: 'Otwórz podgląd' }).click();
		const popup = await popupPromise;
		await expect(popup.locator('iframe[title="Podgląd wyceny"]')).toHaveAttribute('sandbox', '');
		expect(await popup.evaluate(() => window.opener)).toBeNull();
		await popup.close();
		await page.getByRole('button', { name: 'Pokaż edycję wyceny' }).click();
		await expect(title).toHaveValue('Zmieniony szkic');
		await expect(page.getByLabel('Ilość pozycji 1')).toHaveValue('2');
		await actionBar.getByRole('button', { name: 'Zapisz szkic' }).click();
		await expect(actionBar.getByRole('status')).toHaveText('Zapisano');
		expect(quote.draft?.title).toBe('Zmieniony szkic');
	});
}

test('keeps quote actions and focused fields clear of an active transfer', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.addInitScript(() => Object.assign(window, {
		__internal_ClerkUICtor: class {},
		Clerk: { user: { id: 'quote-user' }, session: { id: 'quote-session', status: 'active', getToken: async () => 'token' }, load: async () => {}, addListener: () => () => {}, signOut: async () => {} }
	}));
	let releaseUpload!: () => void;
	const uploadGate = new Promise<void>((resolve) => { releaseUpload = resolve; });
	let uploadStarted = false;
	await page.route('https://upload.example/**', async (route) => {
		if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'PUT, OPTIONS', 'access-control-allow-headers': '*' } });
		uploadStarted = true;
		await uploadGate;
		return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: '' });
	});
	await page.route('http://localhost:8787/**', async (route) => {
		const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
		if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
		const method = route.request().url().split('/').at(-1);
		const result = method === 'GetSpaces' ? { spaces: [{ id: 'main', kind: 1 }, { id: 'personal', kind: 2 }] }
			: method === 'GetUploadLimits' ? { maxUploadBytes: '100000000' }
			: method === 'ListEntries' ? { entries: [], nextPageToken: '' }
			: method === 'CreateUpload' ? { session: { id: 'upload', state: 1, attemptId: 'attempt', storageLocation: 1 }, target: { url: 'https://upload.example/held', headers: {} } } : {};
		return route.fulfill({ status: 200, headers, json: result });
	});
	const quote = create(QuoteSchema, { id: 'layout-quote', draftVersion: 1n, draft: { title: 'Wycena testowa', priceMode: QuotePriceMode.GROSS } });
	await page.route('http://localhost:8788/**', async (route) => {
		const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
		if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
		const method = route.request().url().split('/').at(-1);
		const body = method === 'ListQuotes' ? toBinary(ListQuotesResponseSchema, create(ListQuotesResponseSchema, { quotes: [quote] }))
			: method === 'GetQuote' ? toBinary(GetQuoteResponseSchema, create(GetQuoteResponseSchema, { quote }))
			: method === 'GetQuotePreview' ? toBinary(GetQuotePreviewResponseSchema, create(GetQuotePreviewResponseSchema, { html: '<html><body>Szkic</body></html>' })) : null;
		if (!body) return route.fulfill({ status: 404, headers: { ...headers, 'content-type': 'application/json' }, json: { code: 'not_found' } });
		return route.fulfill({ status: 200, headers: { ...headers, 'content-type': 'application/proto' }, body: Buffer.from(body) });
	});
	try {
		await page.goto('/');
		await page.getByLabel('Wybierz pliki do przesłania').setInputFiles({ name: 'transfer.txt', mimeType: 'text/plain', buffer: Buffer.from('plik') });
		await expect.poll(() => uploadStarted).toBe(true);
		await page.getByRole('button', { name: 'Przełącz menu' }).click();
		await page.getByRole('navigation', { name: 'Nawigacja mobilna' }).getByRole('link', { name: 'Wyceny' }).click();
		await page.getByRole('link', { name: /Wycena testowa/ }).click();
		const transfer = page.getByRole('region', { name: 'Transfery' });
		const bar = page.getByRole('region', { name: 'Zapis wyceny' });
		await transfer.getByRole('button', { name: 'Rozwiń' }).click();
		await expect.poll(async () => {
			const barBox = await bar.boundingBox();
			const transferBox = await transfer.boundingBox();
			return !!barBox && !!transferBox && barBox.y + barBox.height <= transferBox.y;
		}).toBe(true);
		const field = page.getByLabel('Wstęp');
		await field.focus();
		await expect.poll(async () => {
			const fieldBox = await field.boundingBox();
			const barBox = await bar.boundingBox();
			const transferBox = await transfer.boundingBox();
			return !!fieldBox && !!barBox && !!transferBox &&
				(fieldBox.y + fieldBox.height <= barBox.y || fieldBox.y >= barBox.y + barBox.height) &&
				fieldBox.y + fieldBox.height <= transferBox.y;
		}).toBe(true);
	} finally {
		releaseUpload();
	}
});
