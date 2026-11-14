import { expect, test } from 'playwright/test';

test('moves a private file into a shared folder', async ({ page }, testInfo) => {
	const moves: Array<Record<string, unknown>> = [];
	const file = { id: 'report', spaceId: 'personal', name: 'report.txt', kind: 2, revision: 1, sizeBytes: '1' };
	const folder = { id: 'destination', spaceId: 'main', name: 'Zespół', kind: 1, revision: 1, sizeBytes: '0' };
	await page.addInitScript(() => Object.assign(window, { __internal_ClerkUICtor: class {}, Clerk: { user: { id: 'cross-user' }, session: { id: 'cross-session', status: 'active', getToken: async () => 'token' }, load: async () => {}, addListener: () => () => {}, signOut: async () => {} } }));
	await page.route('http://localhost:8787/**', async (route) => {
		const request = route.request();
		const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
		if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
		const method = request.url().split('/').at(-1);
		const body = request.postDataJSON() as Record<string, unknown>;
		let result: object = {};
		if (method === 'GetSpaces') result = { spaces: [{ id: 'personal', kind: 2 }, { id: 'main', kind: 1 }] };
		if (method === 'GetUploadLimits') result = { maxUploadBytes: '100000000' };
		if (method === 'ListEntries') result = { entries: body.parentId ? [] : body.spaceId === 'main' ? [folder] : [file], nextPageToken: '' };
		if (method === 'MoveEntry') { moves.push(body); result = { entry: { ...file, spaceId: 'main', parentId: 'destination', revision: 2 } }; }
		await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});
	await page.goto('/personal');
	if (testInfo.project.name === 'mobile') {
		await page.getByRole('button', { name: 'Akcje dla report.txt' }).click();
		await page.getByRole('button', { name: 'Przenieś', exact: true }).click();
	} else await page.getByRole('button', { name: 'Przenieś report.txt', exact: true }).click();
	const dialog = page.getByRole('dialog', { name: 'Przenieś element' });
	await dialog.getByRole('combobox', { name: 'Przestrzeń docelowa' }).selectOption('main');
	await dialog.getByRole('button', { name: 'Otwórz folder Zespół' }).click();
	await dialog.getByRole('button', { name: 'Przenieś tutaj' }).click();
	await expect.poll(() => moves.length).toBe(1);
	expect(moves[0]).toMatchObject({ spaceId: 'personal', targetSpaceId: 'main', entryId: 'report', parentId: 'destination', expectedRevision: 1 });
});
