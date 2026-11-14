import { expect, test } from 'playwright/test';

test('moves an entry between folders from the desktop or mobile catalog', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name === 'firefox', 'Move acceptance runs in Chromium desktop and mobile.');
	const requests: Array<{ method: string; body: Record<string, unknown> }> = [];
	const target = {
		id: 'archive',
		spaceId: 'personal',
		kind: 1,
		name: 'Archiwum',
		revision: 1,
		sizeBytes: '0'
	};
	const file = {
		id: 'report',
		spaceId: 'personal',
		kind: 2,
		name: 'raport.txt',
		sizeBytes: '17',
		revision: 7,
		storageLocation: 1
	};
	await page.addInitScript(() => {
		Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: {
				user: { id: 'move-e2e-user' },
				session: { id: 'move-e2e-session', status: 'active', getToken: async () => 'move-e2e-token' },
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
				result = {
					entries: body.parentId === 'archive' ? [] : [target, file],
					nextPageToken: ''
				};
				break;
			case 'MoveEntry':
				result = { entry: { ...file, parentId: body.parentId ?? '', revision: 8 } };
				break;
			case 'GetMe':
			case 'ListTrash':
				break;
			default:
				throw new Error(`Unexpected RPC ${method}`);
		}
		await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});

	await page.goto('/personal');
	await expect(page.getByRole('heading', { name: 'Pliki prywatne' })).toBeAttached();
	if (testInfo.project.name === 'mobile') {
		await page.getByRole('button', { name: 'Akcje dla raport.txt' }).click();
		await page.getByRole('button', { name: 'Przenieś', exact: true }).click();
	} else {
		await page.getByRole('button', { name: 'Przenieś raport.txt', exact: true }).click();
	}
	const dialog = page.getByRole('dialog', { name: 'Przenieś element' });
	await dialog.getByRole('button', { name: 'Otwórz folder Archiwum' }).click();
	await dialog.getByRole('button', { name: 'Przenieś tutaj' }).click();
	await expect.poll(() => requests.filter((item) => item.method === 'MoveEntry')).toHaveLength(1);
	expect(requests.find((item) => item.method === 'MoveEntry')?.body).toMatchObject({
		spaceId: 'personal',
		entryId: 'report',
		parentId: 'archive',
		expectedRevision: 7
	});
	await expect(dialog).toBeHidden();
});

test('moves a catalog file by dragging it onto a destination folder', async ({ page }, testInfo) => {
	test.skip(testInfo.project.name !== 'chromium', 'Desktop catalog drag and drop runs in Chromium.');
	const requests: Array<{ method: string; body: Record<string, unknown> }> = [];
	const target = { id: 'archive', spaceId: 'personal', kind: 1, name: 'Archiwum', revision: 1, sizeBytes: '0' };
	const file = { id: 'dragged-report', spaceId: 'personal', kind: 2, name: 'przenoszony.txt', sizeBytes: '17', revision: 7 };
	await page.addInitScript(() => {
		Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: {
				user: { id: 'drag-e2e-user' },
				session: { id: 'drag-e2e-session', status: 'active', getToken: async () => 'drag-e2e-token' },
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
			case 'ListEntries': result = { entries: body.parentId === 'archive' ? [] : [target, file], nextPageToken: '' }; break;
			case 'MoveEntry': result = { entry: { ...file, parentId: body.parentId, revision: 8 } }; break;
			case 'GetMe':
			case 'ListTrash': break;
			default: throw new Error(`Unexpected RPC ${method}`);
		}
		await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});

	await page.goto('/personal');
	await expect(page.getByRole('heading', { name: 'Pliki prywatne' })).toBeAttached();
	await page.getByRole('row', { name: /przenoszony\.txt/ }).dragTo(page.getByRole('row', { name: /Archiwum/ }));
	await expect.poll(() => requests.filter((request) => request.method === 'MoveEntry')).toHaveLength(1);
	expect(requests.find((request) => request.method === 'MoveEntry')?.body).toMatchObject({
		spaceId: 'personal',
		entryId: 'dragged-report',
		parentId: 'archive',
		expectedRevision: 7
	});
});
