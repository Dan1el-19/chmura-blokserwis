import { expect, test } from 'playwright/test';

for (const width of [320, 390]) {
	test(`file actions fit the viewport at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: width === 390 ? 844 : 740 });
		let creates = 0;
		await page.addInitScript(() => Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: { user: { id: 'ui-user' }, session: { id: 'ui-session', status: 'active', getToken: async () => 'token' }, load: async () => {}, addListener: () => () => {}, signOut: async () => {} }
		}));
		await page.route('http://localhost:8787/**', async (route) => {
			const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
			if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
			const method = route.request().url().split('/').at(-1);
			if (method === 'CreateShare') creates++;
			const result = method === 'GetSpaces' ? { spaces: [{ id: 'personal', kind: 2 }] }
				: method === 'ListEntries' ? { entries: [{ id: 'file', spaceId: 'personal', kind: 2, name: 'Bardzo dluga nazwa pliku testowego.txt', revision: 1, sizeBytes: '10', storageLocation: 2 }], nextPageToken: '' }
				: method === 'ListShares' ? { shares: [{ id: 'link', address: 'existing-link', revision: 1, viewCount: '0', downloadCount: '0' }] }
				: method === 'GetDownload' ? { url: 'https://storage.example/file' } : {};
			return route.fulfill({ status: 200, headers, json: result });
		});
		await page.route('https://storage.example/**', (route) => route.fulfill({ status: 200, headers: { 'content-disposition': 'attachment; filename="file.txt"' }, body: 'file' }));
		await page.goto('/personal');
		const trigger = page.getByRole('button', { name: 'Akcje dla Bardzo dluga nazwa pliku testowego.txt' });
		if (width === 390) {
			const row = page.getByRole('group', { name: 'Bardzo dluga nazwa pliku testowego.txt' });
			await expect(row).toBeVisible();
			const box = await row.boundingBox();
			expect(box?.y).toBeLessThanOrEqual(300);
		}
		await trigger.click();
		for (const name of ['Pobierz', 'Udostępnij', 'Przenieś', 'Zmień nazwę', 'Szczegóły', 'Do kosza']) {
			const action = page.getByRole('button', { name, exact: true });
			await expect(action).toBeInViewport();
			const box = await action.boundingBox();
			expect(box && box.x >= 0 && box.x + box.width <= width).toBeTruthy();
		}
		expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
		await page.getByRole('button', { name: 'Zamknij menu działań' }).click();
		await expect(trigger).toBeFocused();
		await trigger.click();
		await page.keyboard.press('Escape');
		await expect(trigger).toBeFocused();
		await trigger.click();
		await page.getByRole('button', { name: 'Zmień nazwę', exact: true }).click();
		await expect(page.getByRole('dialog')).toHaveCount(1);
		await expect(page.getByRole('dialog')).toContainText('Zmień nazwę');
		await page.keyboard.press('Escape');
		await trigger.click();
		await page.getByRole('button', { name: 'Szczegóły', exact: true }).click();
		await expect(page.getByRole('dialog')).toContainText('Bardzo dluga nazwa pliku testowego.txt');
		await expect(page.getByRole('dialog')).toContainText('Zmodyfikowano');
		await expect(page.getByRole('dialog')).toContainText('RustFS');
		await page.keyboard.press('Escape');
		await trigger.click();
		await page.getByRole('button', { name: 'Udostępnij', exact: true }).click();
		const shareDialog = page.getByRole('dialog', { name: 'Udostępnij plik' });
		await expect(shareDialog.getByRole('button', { name: 'Kopiuj link' })).toBeInViewport();
		await expect(shareDialog.getByLabel('Etykieta (opcjonalnie)')).toHaveCount(0);
		expect(creates).toBe(0);
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
