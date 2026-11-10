import { expect, test } from 'playwright/test';

test('retries uncertain bulk move with its original request id and keeps failures selected', async ({ page }, info) => {
	const requests: Record<string, unknown>[] = [];
	let moved = false;
	await page.addInitScript(() => Object.assign(window, { __internal_ClerkUICtor: class {}, Clerk: { user: { id: 'bulk-move-user' }, session: { id: 'bulk-move-session', status: 'active', getToken: async () => 'token' }, load: async () => {}, addListener: () => () => {}, signOut: async () => {} } }));
	await page.route('http://localhost:8787/**', async (route) => {
		const request = route.request();
		const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
		if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
		const method = request.url().split('/').at(-1)!;
		const body = request.postDataJSON() as Record<string, unknown>;
		let result: object = {};
		if (method === 'GetSpaces') result = { spaces: [{ id: 'personal', kind: 2 }, { id: 'main', kind: 1 }] };
		else if (method === 'GetUploadLimits') result = { maxUploadBytes: '100000000' };
		else if (method === 'ListEntries') result = body.spaceId === 'main' ? { entries: [] } : { entries: ['one', 'two'].filter((id) => !moved || id !== 'one').map((id) => ({ id, spaceId: 'personal', kind: 2, name: `${id}.txt`, revision: 1 })) };
		else if (method === 'BulkMoveEntries') {
			requests.push(body);
			if (requests.length === 1) return route.abort('failed');
			moved = true;
			result = { results: [{ entryId: 'one', success: true }, { entryId: 'two', success: false, error: 'ALREADY_EXISTS' }] };
		} else if (!['GetMe', 'ListTrash'].includes(method)) throw new Error(`Unexpected RPC ${method}`);
		return route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});
	await page.goto('/personal');
	if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Zaznacz elementy' }).click();
	await page.getByRole('checkbox', { name: 'Zaznacz wszystkie wczytane elementy' }).first().check();
	await page.getByRole('toolbar').getByRole('button', { name: 'Przenieś', exact: true }).click();
	await page.getByLabel('Przestrzeń docelowa').selectOption('main');
	await page.getByRole('dialog').getByRole('button', { name: 'Przenieś tutaj' }).click();
	await expect.poll(() => requests.length).toBe(1);
	await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
	await page.getByRole('dialog').getByRole('button', { name: 'Przenieś tutaj' }).click();
	await expect.poll(() => requests.length).toBe(2);
	expect(requests[1]).toEqual(requests[0]);
	await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Nie udało się przenieść 1');
});
