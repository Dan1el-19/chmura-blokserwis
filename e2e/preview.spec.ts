import { expect, test } from 'playwright/test';

test('opens a supported image preview and keeps downloading available', async ({ page }, testInfo) => {
	const requests: Array<{ method: string; body: Record<string, unknown> }> = [];
	const image = {
		id: 'preview-image',
		spaceId: 'personal',
		kind: 2,
		name: 'photo.png',
		sizeBytes: '3',
		revision: 1
	};
	await page.addInitScript(() => {
		Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: {
				user: { id: 'preview-e2e-user' },
				session: { id: 'preview-e2e-session', status: 'active', getToken: async () => 'preview-e2e-token' },
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
			case 'GetSpaces':
				result = { spaces: [{ id: 'personal', kind: 2 }, { id: 'main', kind: 1 }] };
				break;
			case 'GetUploadLimits':
				result = { maxUploadBytes: '100000000', canManage: false };
				break;
			case 'ListEntries':
				result = { entries: [image], nextPageToken: '' };
				break;
			case 'GetPreview':
				result = {
					url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6xkAAAAASUVORK5CYII=',
					expiresAt: new Date(Date.now() + 300_000).toISOString(),
					contentType: 'image/png',
					mediaKind: 'PREVIEW_MEDIA_KIND_IMAGE'
				};
				break;
			case 'GetDownload':
				result = { url: 'https://storage.example/download' };
				break;
			case 'GetMe':
			case 'ListTrash':
				break;
			default:
				throw new Error(`Unexpected RPC ${method}`);
		}
		await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});
	await page.route('https://storage.example/**', (route) =>
		route.fulfill({
			status: 200,
			headers: { 'content-disposition': 'attachment; filename="photo.png"' },
			body: 'file bytes'
		})
	);

	await page.goto('/personal');
	await expect(page.getByRole('heading', { name: 'Pliki prywatne' })).toBeAttached();
	await page.getByRole('button', { name: 'Podgląd photo.png' }).first().click();
	const dialog = page.getByRole('dialog', { name: 'photo.png' });
	await expect(dialog.getByRole('img', { name: 'photo.png' })).toBeVisible();
	expect(requests.find((request) => request.method === 'GetPreview')?.body).toMatchObject({
		spaceId: 'personal',
		entryId: 'preview-image'
	});
	const previewDownload = page.waitForEvent('download');
	await dialog.getByRole('button', { name: 'Pobierz', exact: true }).click();
	expect((await previewDownload).suggestedFilename()).toBe('photo.png');
	await expect.poll(() => requests.filter((request) => request.method === 'GetDownload')).toHaveLength(1);
	await page.goBack();
	await expect(dialog).toBeHidden();
	await expect(page).toHaveURL('/personal');
	const separateDownload = page.waitForEvent('download');
	if (testInfo.project.name === 'mobile') {
		await page.getByRole('button', { name: 'Akcje dla photo.png' }).click();
		await page.getByRole('button', { name: 'Pobierz', exact: true }).click();
	} else await page.getByRole('button', { name: 'Pobierz photo.png' }).click();
	expect((await separateDownload).suggestedFilename()).toBe('photo.png');
	await expect.poll(() => requests.filter((request) => request.method === 'GetDownload')).toHaveLength(2);
});
