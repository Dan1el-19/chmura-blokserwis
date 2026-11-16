import { create, toBinary } from '@bufbuild/protobuf';
import { expect, test } from 'playwright/test';
import { GetQuotePdfResponseSchema, GetQuoteResponseSchema, QuotePriceMode, QuoteSchema } from '../src/lib/gen/unisource/v2/quotes_pb.js';

function pdfFixture(): Buffer {
	const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>', '<< /Length 44 >>\nstream\nBT /F1 18 Tf 40 750 Td (Hello PDF) Tj ET\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
	let source = '%PDF-1.4\n'; const offsets = [0];
	objects.forEach((object, i) => { offsets.push(source.length); source += `${i + 1} 0 obj\n${object}\nendobj\n`; });
	const xref = source.length; source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	source += offsets.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
	return Buffer.from(source + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}

for (const width of [320, 390, 768, 1024, 1280, 1440]) {
	test(`renders actual PDF preview at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 844 });
		await page.addInitScript(() => Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: { user: { id: 'quote-user' }, session: { id: 'quote-session', status: 'active', getToken: async () => 'token' }, load: async () => {}, addListener: () => () => {}, signOut: async () => {} }
		}));
		await page.route('http://localhost:8787/**', (route) => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' }, json: {} }));
		const quote = create(QuoteSchema, { id: 'v2-layout', draftVersion: 1n, draft: { title: 'Wycena', client: 'Klient', documentSchemaVersion: 2, documentDate: '2026-11-16', priceMode: QuotePriceMode.GROSS, lines: [{ name: 'Kamera', quantity: '2', unitPrice: '20' }] } });
		await page.route('http://localhost:8788/**', async (route) => {
			const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS' };
			if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
			const method = route.request().url().split('/').at(-1);
			const body = method === 'GetQuote' ? toBinary(GetQuoteResponseSchema, create(GetQuoteResponseSchema, { quote }))
				: method === 'GetQuotePdf' ? toBinary(GetQuotePdfResponseSchema, create(GetQuotePdfResponseSchema, { status: 'succeeded', url: 'https://pdf.example/quote.pdf', draftVersion: 1n, templateVersion: '4' })) : undefined;
			if (!body) return route.fulfill({ status: 404, headers: { ...headers, 'content-type': 'application/json' }, json: { code: 'not_found' } });
			return route.fulfill({ status: 200, headers: { ...headers, 'content-type': 'application/proto' }, body: Buffer.from(body) });
		});
		await page.route('https://pdf.example/**', (route) => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'application/pdf' }, body: pdfFixture() }));
		await page.goto('/wyceny/v2-layout');
		await expect(page.getByLabel('Tytuł')).toHaveValue('Wycena');
		const desktop = page.getByRole('button', { name: 'Pokaż podgląd na desktopie' });
		await (await desktop.isVisible() ? desktop : page.getByRole('button', { name: 'Pokaż podgląd wyceny' })).click();
		await expect(page.getByText('Liczba stron: 1')).toBeVisible();
		await expect(page.locator('.textLayer')).toContainText('Hello PDF');
		await expect.poll(() => page.locator('#main-content').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
		const zoom = page.getByRole('button', { name: 'Powiększ podgląd' });
		await zoom.focus(); await expect(zoom).toBeFocused(); await page.keyboard.press('Enter');
		await expect(page.getByRole('button', { name: 'Dopasuj do szerokości' })).toHaveAttribute('aria-pressed', 'false');
		await page.setViewportSize({ width: width === 390 ? 1440 : width, height: 844 });
		await expect(page.locator('.textLayer')).toContainText('Hello PDF');
		if (width === 1440) {
			await page.evaluate(() => { document.documentElement.style.zoom = '200%'; });
			await expect(page.getByText('Liczba stron: 1')).toBeVisible();
			await expect.poll(() => page.locator('#main-content').evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
		}
	});
}
