import { expect, test } from 'playwright/test';

test('creates and copies a labelled public link without changing its address', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'chromium', 'Clipboard acceptance runs in Chromium.');
	await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
	const file = { id: 'share-file', spaceId: 'personal', kind: 2, name: 'shared.png', sizeBytes: '3', revision: 1 };
	const createdLink = {
		id: 'share-id',
		address: 'client-photo',
		createdAt: new Date().toISOString(),
		label: 'Dla klienta X',
		hasPassword: false,
		maxDownloads: '2',
		downloadCount: '0',
		viewCount: '0',
		revision: 1
	};
	await page.addInitScript(() => {
		Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: {
				user: { id: 'share-links-e2e-user' },
				session: { id: 'share-links-e2e-session', status: 'active', getToken: async () => 'share-links-e2e-token' },
				load: async () => {},
				addListener: () => () => {},
				signOut: async () => {}
			}
		});
	});
	await page.route('http://localhost:8787/**', async (route) => {
		const request = route.request();
		const headers = {
			'access-control-allow-origin': '*',
			'access-control-allow-headers': '*',
			'access-control-allow-methods': 'POST, OPTIONS',
			'content-type': 'application/json'
		};
		if (request.method() === 'OPTIONS') {
			await route.fulfill({ status: 204, headers });
			return;
		}
		const method = request.url().split('/').at(-1)!;
		const result: object = method === 'GetSpaces'
			? { spaces: [{ id: 'personal', kind: 2 }, { id: 'main', kind: 1 }] }
			: method === 'GetUploadLimits'
				? { maxUploadBytes: '100000000', canManage: false }
				: method === 'ListEntries'
					? { entries: [file], nextPageToken: '' }
					: method === 'ListShares'
						? { shares: [] }
						: method === 'CreateShare'
							? { share: createdLink }
							: {};
		await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});

	await page.goto('/personal');
	await expect(page.getByRole('heading', { name: 'Pliki prywatne' })).toBeAttached();
	await page.getByRole('button', { name: 'Akcje dla shared.png' }).click();
	await page.getByRole('button', { name: 'Udostępnij', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Udostępnij plik' });
	await expect(dialog.getByLabel('Etykieta (opcjonalnie)')).toHaveCount(0);
	await expect(dialog.getByLabel('Własny adres linku (opcjonalnie)')).toHaveCount(0);
	await dialog.getByRole('button', { name: 'Utwórz link', exact: true }).click();
	await dialog.getByLabel('Własny adres linku (opcjonalnie)').fill('client-photo');
	await dialog.getByLabel('Etykieta (opcjonalnie)').fill('Dla klienta X');
	await dialog.getByRole('button', { name: 'Zamknij formularz' }).click();
	await dialog.getByRole('button', { name: 'Utwórz link', exact: true }).click();
	await expect(dialog.getByLabel('Etykieta (opcjonalnie)')).toHaveValue('Dla klienta X');
	await dialog.getByLabel('Limit pobrań (opcjonalnie)').fill('2');
	await dialog.getByRole('button', { name: 'Utwórz link' }).click();
	const link = dialog.getByRole('listitem');
	await expect(link.getByText('Dla klienta X')).toBeVisible();
	await expect(link).toBeFocused();
	await expect(dialog.getByLabel('Etykieta (opcjonalnie)')).toHaveCount(0);
	await expect(link).toContainText('Pobrania: 0 / 2');
	await link.getByRole('button', { name: 'Kopiuj link' }).click();
	await expect(page.getByText('Skopiowano link.', { exact: true })).toBeVisible();
	expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://127.0.0.1:3100/s/client-photo');
});
