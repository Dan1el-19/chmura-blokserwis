import { expect, test } from 'playwright/test';

test('opens Main by default and preserves old private folder bookmarks', async ({ page }) => {
	const listings: Array<Record<string, unknown>> = [];
	await page.addInitScript(() => {
		Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: {
				user: { id: 'home-e2e-user' },
				session: { id: 'home-e2e-session', status: 'active', getToken: async () => 'token' },
				load: async () => {}, addListener: () => () => {}, signOut: async () => {}
			}
		});
	});
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
		if (method === 'GetEntry' && body.spaceId === 'personal' && body.entryId === 'old-folder')
			result = { entry: { id: 'old-folder', spaceId: 'personal', kind: 1, name: 'Stary folder', revision: 1 } };
		await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});
	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Pliki wspólne' })).toBeAttached();
	await expect.poll(() => listings.some((body) => body.spaceId === 'main')).toBe(true);
	await page.goto('/main?view=grid#section');
	await expect(page).toHaveURL(/\/?view=grid#section$/);
	await page.goto('/?folder=old-folder&view=grid#section');
	await expect(page).toHaveURL(/\/personal\?folder=old-folder&view=grid#section$/);
	await expect(page.getByRole('heading', { name: 'Pliki prywatne' })).toBeAttached();
});
