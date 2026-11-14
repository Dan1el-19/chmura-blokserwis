import { expect, test } from 'playwright/test';

test('retries uncertain bulk deletion and retains failed trash entries', async ({ page }) => {
	const requests: Record<string, unknown>[] = [];
	let removed = false;
	await page.addInitScript(() => Object.assign(window, { __internal_ClerkUICtor: class {}, Clerk: { user: { id: 'bulk-delete-user' }, session: { id: 'bulk-delete-session', status: 'active', getToken: async () => 'token' }, load: async () => {}, addListener: () => () => {}, signOut: async () => {} } }));
	await page.route('http://localhost:8787/**', async (route) => {
		const request = route.request();
		const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
		if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
		const method = request.url().split('/').at(-1)!;
		let result: object = {};
		if (method === 'GetSpaces') result = { spaces: [{ id: 'personal', kind: 2 }, { id: 'main', kind: 1 }] };
		else if (method === 'GetUploadLimits') result = { maxUploadBytes: '100000000' };
		else if (method === 'ListTrash') result = { items: ['one', 'two'].filter((id) => !removed || id !== 'one').map((id) => ({ entry: { id, spaceId: 'main', kind: 2, name: `${id}.txt`, revision: 2 } })) };
		else if (method === 'BulkDeletePermanently') {
			requests.push(request.postDataJSON());
			if (requests.length === 1) return route.abort('failed');
			removed = true;
			result = { results: [{ entryId: 'one', success: true }, { entryId: 'two', success: false, error: 'REVISION_CONFLICT' }] };
		} else if (!['GetMe', 'ListEntries'].includes(method)) throw new Error(`Unexpected RPC ${method}`);
		return route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});
	await page.goto('/trash');
	await page.getByRole('checkbox', { name: 'Zaznacz one.txt' }).check();
	await page.getByRole('checkbox', { name: 'Zaznacz two.txt' }).check();
	await page.getByRole('button', { name: 'Usuń zaznaczone trwale' }).click();
	await page.getByRole('dialog').getByRole('button', { name: 'Zleć trwałe usunięcie' }).click();
	await expect(page.getByRole('dialog').getByRole('alert')).toBeVisible();
	await page.getByRole('dialog').getByRole('button', { name: 'Zleć trwałe usunięcie' }).click();
	await expect.poll(() => requests.length).toBe(2);
	expect(requests[1]).toEqual(requests[0]);
	await expect(page.getByRole('dialog').getByRole('alert')).toContainText('nie udało się usunąć 1');
	await page.getByRole('dialog').getByRole('button', { name: 'Zamknij' }).click();
	await expect(page.getByRole('checkbox', { name: 'Zaznacz two.txt' })).toBeChecked();
});
