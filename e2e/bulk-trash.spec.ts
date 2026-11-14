import { expect, test } from 'playwright/test';

test('retries an uncertain bulk trash request with the same id and keeps failed items selected', async ({ page }, info) => {
	const requests: Record<string, unknown>[] = [];
	await page.addInitScript(() => Object.assign(window, { __internal_ClerkUICtor: class {}, Clerk: { user: { id: 'bulk-user' }, session: { id: 'bulk-session', status: 'active', getToken: async () => 'token' }, load: async () => {}, addListener: () => () => {}, signOut: async () => {} } }));
	await page.route('http://localhost:8787/**', async (route) => {
		const request = route.request();
		const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
		if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
		const method = request.url().split('/').at(-1)!;
		let result: object = {};
		if (method === 'GetSpaces') result = { spaces: [{ id: 'personal', kind: 2 }, { id: 'main', kind: 1 }] };
		else if (method === 'GetUploadLimits') result = { maxUploadBytes: '100000000' };
		else if (method === 'ListEntries') result = { entries: [{ id: 'one', spaceId: 'personal', kind: 2, name: 'one.txt', revision: 1 }, { id: 'two', spaceId: 'personal', kind: 2, name: 'two.txt', revision: 1 }] };
		else if (method === 'BulkTrashEntries') {
			requests.push(request.postDataJSON());
			if (requests.length === 1) return route.abort('failed');
			result = { results: [{ entryId: 'one', success: true }, { entryId: 'two', success: false, error: 'REVISION_CONFLICT' }] };
		} else if (!['GetMe', 'ListTrash'].includes(method)) throw new Error(`Unexpected RPC ${method}`);
		return route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});
	await page.goto('/personal');
	if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Zaznacz elementy' }).click();
	await page.getByRole('checkbox', { name: 'Zaznacz wszystkie wczytane elementy' }).first().check();
	await page.getByRole('toolbar').getByRole('button', { name: 'Do kosza' }).click();
	await page.getByRole('button', { name: 'Przenieś do kosza', exact: true }).click();
	await expect.poll(() => requests.length).toBe(1);
	await page.getByRole('button', { name: 'Ponów nieudane' }).click();
	await expect.poll(() => requests.length).toBe(2);
	expect(requests[1]).toEqual(requests[0]);
	await expect(page.getByText(/Zaznaczenie zachowano dla nieobsłużonych/)).toBeVisible();
});
