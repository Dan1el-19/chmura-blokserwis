import { expect, test } from 'playwright/test';

test('shows a bounded public code preview as inert text when Range is ignored', async ({ page }) => {
	let range = '';
	await page.route('**/s/code-token/visit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
	await page.route('**/s/code-token/info', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'code.js', sizeBytes: 2_000_000, requiresPassword: false, maxDownloads: null, downloadCount: 0, viewCount: 1, downloadLimitReached: false, preview: { url: 'https://storage.example/code', expiresAt: new Date(Date.now() + 300_000).toISOString(), contentType: 'text/plain', mediaKind: 'TEXT', contentId: 'content-1' } }) }));
	await page.route('https://storage.example/code', async (route) => {
		range = route.request().headers().range ?? '';
		await route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'content-type': 'text/plain' }, body: '<script>window.intrusion = true</script>' + 'x'.repeat(1_100_000) });
	});
	await page.goto('/s/code-token');
	const pre = page.locator('pre');
	await expect(pre).toBeVisible();
	await expect.poll(() => pre.evaluate((element) => element.textContent?.length)).toBe(1024 * 1024);
	await expect(page.getByText(/Podgląd skrócono do 1 MiB/)).toBeVisible();
	expect(range).toBe('bytes=0-1048576');
	expect(await page.evaluate(() => (window as Window & { intrusion?: boolean }).intrusion)).toBeUndefined();
	await expect(page.getByRole('button', { name: 'Pobierz' })).toBeVisible();
});

test('offers a public browser PDF reader', async ({ page }) => {
	await page.route('**/s/pdf-token/visit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
	await page.route('**/s/pdf-token/info', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'document.pdf', sizeBytes: 10, requiresPassword: false, maxDownloads: null, downloadCount: 0, viewCount: 1, downloadLimitReached: false, preview: { url: 'https://storage.example/document.pdf', expiresAt: new Date(Date.now() + 300_000).toISOString(), contentType: 'application/pdf', mediaKind: 'PDF', contentId: 'content-2' } }) }));
	await page.route('https://storage.example/document.pdf', (route) => route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4\n%%EOF' }));
	await page.goto('/s/pdf-token');
	await expect(page.locator('iframe[title="Podgląd PDF: document.pdf"]')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Pobierz' })).toBeVisible();
});

test('reloads changed content after a preview renewal even when the URL is unchanged', async ({ page }) => {
	await page.clock.install();
	let generation = 0;
	await page.route('**/s/renew-token/visit', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
	await page.route('**/s/renew-token/info', (route) => {
		generation++;
		return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ name: 'note.txt', sizeBytes: 3, requiresPassword: false, maxDownloads: null, downloadCount: 0, viewCount: 1, downloadLimitReached: false, preview: { url: 'https://storage.example/note', expiresAt: new Date(Date.now() + 11_000).toISOString(), contentType: 'text/plain', mediaKind: 'TEXT', contentId: `generation-${generation}` } }) });
	});
	await page.route('https://storage.example/note', (route) => route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*' }, body: generation === 1 ? 'old' : 'new' }));
	await page.goto('/s/renew-token');
	await expect(page.locator('pre')).toHaveText('old');
	await page.clock.fastForward(2000);
	await expect(page.locator('pre')).toHaveText('new');
	await expect(page.getByText('Nie udało się odnowić podglądu. Plik nadal można pobrać.')).toBeHidden();
});
