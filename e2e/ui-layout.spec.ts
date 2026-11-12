import { expect, test } from 'playwright/test';

for (const width of [320, 390]) {
	test(`file actions fit the viewport at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 740 });
		await page.addInitScript(() => Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: { user: { id: 'ui-user' }, session: { id: 'ui-session', status: 'active', getToken: async () => 'token' }, load: async () => {}, addListener: () => () => {}, signOut: async () => {} }
		}));
		await page.route('http://localhost:8787/**', async (route) => {
			const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
			if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
			const method = route.request().url().split('/').at(-1);
			const result = method === 'GetSpaces' ? { spaces: [{ id: 'personal', kind: 2 }] }
				: method === 'ListEntries' ? { entries: [{ id: 'file', spaceId: 'personal', kind: 2, name: 'Bardzo dluga nazwa pliku testowego.txt', revision: 1, sizeBytes: '10' }], nextPageToken: '' }
				: method === 'GetDownload' ? { url: 'https://storage.example/file' } : {};
			return route.fulfill({ status: 200, headers, json: result });
		});
		await page.route('https://storage.example/**', (route) => route.fulfill({ status: 200, headers: { 'content-disposition': 'attachment; filename="file.txt"' }, body: 'file' }));
		await page.goto('/personal');
		const trigger = page.getByRole('button', { name: 'Akcje dla Bardzo dluga nazwa pliku testowego.txt' });
		await trigger.click();
		for (const name of ['Pobierz', 'Udostępnij', 'Przenieś', 'Zmień nazwę', 'Do kosza']) {
			const action = page.getByRole('button', { name, exact: true });
			await expect(action).toBeInViewport();
			const box = await action.boundingBox();
			expect(box && box.x >= 0 && box.x + box.width <= width).toBeTruthy();
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await page.keyboard.press('Escape');
		await expect(trigger).toBeFocused();
		await trigger.click();
		await page.getByRole('button', { name: 'Zmień nazwę', exact: true }).click();
		await expect(page.getByRole('dialog')).toHaveCount(1);
		await expect(page.getByRole('dialog')).toContainText('Zmień nazwę');
		await page.keyboard.press('Escape');
		await trigger.click();
		await page.setViewportSize({ width: 1024, height: 740 });
		await expect(page.locator('dialog[open]')).toHaveCount(0);
		await page.setViewportSize({ width, height: 740 });
		await trigger.click();
		const download = page.waitForEvent('download');
		await page.getByRole('button', { name: 'Pobierz', exact: true }).click();
		await download;
	});
}
