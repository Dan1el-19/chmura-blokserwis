import { expect, test } from 'playwright/test';

test('selects loaded rows, skips folders during bulk downloads, and supports mobile selection mode', async ({ page }, testInfo) => {
	const requests: Array<{ method: string; body: Record<string, unknown> }> = [];
	const entries = [
		{ id: 'reports', spaceId: 'personal', kind: 1, name: 'Raporty', revision: 1, sizeBytes: '0' },
		{ id: 'one', spaceId: 'personal', kind: 2, name: 'jeden.txt', revision: 1, sizeBytes: '10' },
		{ id: 'two', spaceId: 'personal', kind: 2, name: 'dwa.txt', revision: 1, sizeBytes: '20' }
	];
	await page.addInitScript(() => {
		Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: {
				user: { id: 'selection-e2e-user' },
				session: { id: 'selection-e2e-session', status: 'active', getToken: async () => 'selection-e2e-token' },
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
		const body = request.postDataJSON() as Record<string, unknown>;
		requests.push({ method, body });
		let result: object = {};
		switch (method) {
			case 'GetSpaces': result = { spaces: [{ id: 'personal', kind: 2 }, { id: 'main', kind: 1 }] }; break;
			case 'GetUploadLimits': result = { maxUploadBytes: '100000000', canManage: false }; break;
			case 'ListEntries': result = { entries, nextPageToken: '' }; break;
			case 'GetDownload': result = { url: `https://storage.example/${body.entryId}` }; break;
			case 'GetMe':
			case 'ListTrash': break;
			default: throw new Error(`Unexpected RPC ${method}`);
		}
		await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});
	await page.route('https://storage.example/**', (route) => route.fulfill({
		status: 200,
		headers: { 'content-disposition': 'attachment; filename="download.txt"' },
		body: 'file bytes'
	}));

	await page.emulateMedia({ colorScheme: 'dark' });
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Moje pliki' })).toBeAttached();
	const mainCheckbox = page.getByRole('checkbox', { name: 'Zaznacz wszystkie wczytane elementy' });
	await expect(mainCheckbox).toBeVisible();
	await expect.poll(() => mainCheckbox.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe('rgb(39, 39, 42)');
	await expect.poll(() => mainCheckbox.evaluate((element) => getComputedStyle(element).borderTopColor)).toBe('rgb(113, 113, 122)');
	if (testInfo.project.name === 'mobile') {
		await page.getByRole('button', { name: 'Zaznacz elementy' }).click();
		await page.getByRole('group', { name: 'Raporty' }).getByRole('checkbox', { name: 'Zaznacz Raporty' }).click();
		await expect(page.getByRole('group', { name: 'Raporty' }).getByRole('checkbox', { name: 'Zaznacz Raporty' })).toBeChecked();
		await expect.poll(() => page.getByRole('group', { name: 'Raporty' }).evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe('rgb(24, 24, 27)');
		for (const name of ['jeden.txt', 'dwa.txt'])
			await page.getByRole('button', { name: `Zaznacz lub odznacz ${name}` }).click();
	} else {
		await page.getByRole('checkbox', { name: 'Zaznacz Raporty' }).click();
		await expect(page.getByRole('checkbox', { name: 'Zaznacz Raporty' })).toBeChecked();
		await page.mouse.move(0, 0);
		await expect.poll(() => page.getByRole('row', { name: /Raporty/ }).evaluate((element) => getComputedStyle(element).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
		await page.getByRole('checkbox', { name: 'Zaznacz jeden.txt' }).click();
		await page.getByRole('checkbox', { name: 'Zaznacz dwa.txt' }).click({ modifiers: ['Shift'] });
	}
	await expect(mainCheckbox).toBeChecked();
	await expect(page.getByRole('toolbar', { name: 'Operacje dla zaznaczonych elementów' })).toContainText('Zaznaczono: 3');
	const firstDownload = page.waitForEvent('download');
	const secondDownload = page.waitForEvent('download');
	await page.getByRole('button', { name: 'Pobierz pliki' }).click();
	await Promise.all([firstDownload, secondDownload]);
	await expect.poll(() => requests.filter((request) => request.method === 'GetDownload')).toHaveLength(2);
	expect(requests.filter((request) => request.method === 'GetDownload').map((request) => request.body.entryId)).toEqual(expect.arrayContaining(['one', 'two']));
	expect(requests.some((request) => request.method === 'GetDownload' && request.body.entryId === 'reports')).toBe(false);
	await expect(page.getByText(/Pominięto foldery: 1/)).toBeVisible();
	await expect(mainCheckbox).toHaveJSProperty('indeterminate', true);
	await mainCheckbox.click();
	await expect(mainCheckbox).toBeChecked();
	await mainCheckbox.click();
	await expect(mainCheckbox).not.toBeChecked();
	await expect(page.getByRole('toolbar', { name: 'Operacje dla zaznaczonych elementów' })).toHaveCount(0);
});

test('mobile long press selects without firing on scroll, and a horizontal swipe opens sharing', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'mobile', 'Mobile pointer gestures run in the mobile project.');
	const file = { id: 'photo', spaceId: 'personal', kind: 2, name: 'photo.png', revision: 1, sizeBytes: '10' };
	await page.addInitScript(() => {
		Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: {
				user: { id: 'gesture-e2e-user' },
				session: { id: 'gesture-e2e-session', status: 'active', getToken: async () => 'gesture-e2e-token' },
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
		let result: object = {};
		switch (method) {
			case 'GetSpaces': result = { spaces: [{ id: 'personal', kind: 2 }, { id: 'main', kind: 1 }] }; break;
			case 'GetUploadLimits': result = { maxUploadBytes: '100000000', canManage: false }; break;
			case 'ListEntries': result = { entries: [file], nextPageToken: '' }; break;
			case 'ListShares': result = { shares: [] }; break;
			case 'GetMe':
			case 'ListTrash': break;
			default: throw new Error(`Unexpected RPC ${method}`);
		}
		await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});

	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Moje pliki' })).toBeAttached();
	const card = page.getByRole('group', { name: 'photo.png' });
	const bounds = await card.boundingBox();
	if (!bounds) throw new Error('Could not locate the mobile file card.');
	const x = bounds.x + Math.min(bounds.width / 2, 120);
	const y = bounds.y + Math.min(bounds.height / 2, 40);
	await card.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: x, clientY: y });
	await card.dispatchEvent('pointermove', { pointerType: 'touch', clientX: x, clientY: y + 24 });
	await page.waitForTimeout(650);
	await card.dispatchEvent('pointerup', { pointerType: 'touch', clientX: x, clientY: y + 24 });
	await expect(page.getByRole('toolbar', { name: 'Operacje dla zaznaczonych elementów' })).toHaveCount(0);

	await card.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: x, clientY: y });
	await page.waitForTimeout(650);
	await card.dispatchEvent('pointerup', { pointerType: 'touch', clientX: x, clientY: y });
	await expect(page.getByRole('toolbar', { name: 'Operacje dla zaznaczonych elementów' })).toContainText('Zaznaczono: 1');
	await page.getByRole('button', { name: 'Anuluj zaznaczenie' }).click();
	await card.dispatchEvent('pointerdown', { pointerType: 'touch', clientX: x, clientY: y });
	await card.dispatchEvent('pointerup', { pointerType: 'touch', clientX: x + 96, clientY: y + 8 });
	await expect(page.getByRole('dialog', { name: 'Udostępnij plik' })).toBeVisible();
});
