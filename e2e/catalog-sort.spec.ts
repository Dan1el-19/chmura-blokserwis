import { expect, test } from 'playwright/test';

test('applies catalog sorting from the UI and starts again at the first page', async ({ page }) => {
	const requests: Array<{ method: string; body: Record<string, unknown> }> = [];
	await page.addInitScript(() => {
		Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: {
				user: { id: 'sort-e2e-user' },
				session: { id: 'sort-e2e-session', status: 'active', getToken: async () => 'sort-e2e-token' },
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
			case 'ListEntries': {
				const page = requests.filter((item) => item.method === method).length;
				result = { entries: [], nextPageToken: page < 3 ? `page-${page + 1}` : '' };
				break;
			}
			case 'GetMe':
			case 'ListTrash':
				break;
			default:
				throw new Error(`Unexpected RPC ${method}`);
		}
		await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});

	await page.goto('/personal');
	await expect(page.getByRole('heading', { name: 'Pliki prywatne' })).toBeAttached({ timeout: 15_000 });
	await expect.poll(() => requests.filter((item) => item.method === 'ListEntries')).toHaveLength(1);
	await page.getByRole('button', { name: 'Pokaż więcej' }).click();
	await expect.poll(() => requests.filter((item) => item.method === 'ListEntries')).toHaveLength(2);
	await page.getByRole('combobox', { name: 'Sortowanie' }).selectOption('SIZE:DESC');
	await expect.poll(() => requests.filter((item) => item.method === 'ListEntries')).toHaveLength(3);

	const sortedRequest = requests.filter((item) => item.method === 'ListEntries').at(-1)!;
	expect(sortedRequest.body).toMatchObject({
		sortBy: 'CATALOG_SORT_BY_SIZE',
		sortDirection: 'CATALOG_SORT_DIRECTION_DESC'
	});
	expect(sortedRequest.body.pageToken ?? '').toBe('');
});
