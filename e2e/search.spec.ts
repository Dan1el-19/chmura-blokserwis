import { expect, test } from 'playwright/test';

test('searches one space and loads the next page with its cursor', async ({ page }, testInfo) => {
	const requests: Array<Record<string, unknown>> = [];
	const listings: Array<Record<string, unknown>> = [];
	await page.addInitScript(() => Object.assign(window, {
		__internal_ClerkUICtor: class {},
		Clerk: { user: { id: 'search-user' }, session: { id: 'search-session', status: 'active', getToken: async () => 'token' }, load: async () => {}, addListener: () => () => {}, signOut: async () => {} }
	}));
	await page.route('http://localhost:8787/**', async (route) => {
		const request = route.request();
		const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
		if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
		const method = request.url().split('/').at(-1);
		const body = request.postDataJSON() as Record<string, unknown>;
		let result: object = {};
		if (method === 'GetSpaces') result = { spaces: [{ id: 'main', kind: 1 }, { id: 'personal', kind: 2 }] };
		if (method === 'GetUploadLimits') result = { maxUploadBytes: '100000000' };
		if (method === 'ListEntries') { listings.push(body); result = { entries: [], nextPageToken: '' }; }
		if (method === 'SearchEntries') {
			requests.push(body);
			result = body.pageToken ? { results: [{ entry: { id: 'b', spaceId: 'main', name: 'Żółć_2', kind: 1, revision: 1 }, path: [] }] } : { results: [{ entry: { id: 'a', spaceId: 'main', name: 'Żółć_1', kind: 1, revision: 1 }, path: [{ id: 'folder', name: 'Dokumenty', kind: 1, revision: 1 }] }], nextPageToken: 'cursor' };
		}
		await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});
	await page.goto('/');
	if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: 'Filtry i sortowanie', exact: true }).click();
	await page.getByRole('combobox', { name: 'Typ pliku' }).selectOption('1');
	await expect.poll(() => listings.some((body) => body.fileType === 'CATALOG_FILE_TYPE_IMAGE')).toBe(true);
	await page.getByRole('textbox', { name: 'Szukaj w przestrzeni' }).fill('żółć_');
	await page.getByRole('button', { name: 'Szukaj', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Żółć_1' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Dokumenty' })).toBeVisible();
	await page.getByRole('button', { name: 'Pokaż więcej' }).click();
	await expect(page.getByRole('button', { name: 'Żółć_2' })).toBeVisible();
	expect(requests).toHaveLength(2);
	expect(requests[0]).toMatchObject({ spaceId: 'main', query: 'żółć_', fileType: 'CATALOG_FILE_TYPE_IMAGE' });
	expect(requests[1]).toMatchObject({ spaceId: 'main', query: 'żółć_', fileType: 'CATALOG_FILE_TYPE_IMAGE', pageToken: 'cursor' });
	await page.getByRole('button', { name: 'Wyczyść filtry i sortowanie' }).click();
	await expect.poll(() => requests.length).toBe(3);
	expect(requests[2]).toMatchObject({ spaceId: 'main', query: 'żółć_' });
	expect(requests[2].fileType ?? 'CATALOG_FILE_TYPE_UNSPECIFIED').toBe('CATALOG_FILE_TYPE_UNSPECIFIED');
});
