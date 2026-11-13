import { expect, test } from 'playwright/test';

for (const width of [320, 390, 1280]) {
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
		if (width >= 1024) {
			const row = page.getByRole('row', { name: /Bardzo dluga nazwa pliku testowego/ });
			await expect(row.getByRole('button', { name: 'Pobierz Bardzo dluga nazwa pliku testowego.txt', exact: true })).toBeVisible();
			await trigger.click();
			await page.getByRole('button', { name: 'Szczegóły', exact: true }).click();
			await expect(page.getByRole('dialog')).toContainText('Bardzo dluga nazwa pliku testowego.txt');
			await expect(page.getByRole('dialog')).toContainText('RustFS');
			await page.keyboard.press('Escape');
			await trigger.focus();
			await page.keyboard.press('Enter');
			await page.keyboard.press('Escape');
			await expect(trigger).toBeFocused();
			return;
		}
		if (width === 390) {
			const row = page.getByRole('group', { name: 'Bardzo dluga nazwa pliku testowego.txt' });
			await expect(row).toBeVisible();
			const box = await row.boundingBox();
			expect(box?.y).toBeLessThanOrEqual(300);
			await expect(page.getByRole('button', { name: 'Nowy folder', exact: true })).toHaveCount(0);
			const headerActions = page.getByRole('button', { name: 'Dodatkowe akcje katalogu' });
			await headerActions.click();
			await page.getByRole('dialog').getByRole('button', { name: 'Nowy folder', exact: true }).click();
			await expect(page.getByRole('dialog', { name: 'Nowy folder' })).toBeVisible();
			await page.keyboard.press('Escape');
			await expect(headerActions).toBeFocused();
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
		// Android Chrome must resize the layout viewport when its keyboard opens.
		await expect(page.locator('meta[name="viewport"]')).toHaveAttribute('content', /interactive-widget=resizes-content/);
		await page.setViewportSize({ width, height: 430 });
		await expect(page.getByRole('dialog').getByRole('button', { name: 'Zapisz', exact: true })).toBeInViewport({ ratio: 1 });
		const nameInput = page.getByRole('dialog').getByLabel('Nazwa', { exact: true });
		await nameInput.focus();
		await page.setViewportSize({ width, height: 120 });
		await expect.poll(async () => {
			const input = await nameInput.boundingBox();
			const dialog = await page.getByRole('dialog').boundingBox();
			return !!input && !!dialog && input.y >= dialog.y && input.y + input.height <= dialog.y + dialog.height;
		}).toBe(true);
		await page.setViewportSize({ width, height: width === 390 ? 844 : 740 });
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
