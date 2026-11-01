import { expect, test } from 'playwright/test';

test('opens a public share without initializing Clerk', async ({ page }) => {
	await page.addInitScript(() => {
		Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: {
				user: null,
				session: null,
				load: async () => {},
				addListener: (listener: () => void) => {
					listener();
					return () => {};
				},
				mountSignIn: () => {},
				unmountSignIn: () => {}
			}
		});
	});
	let clerkRequest = false;
	page.on('request', (request) => {
		if (/clerk\.accounts\.|clerk\.com/i.test(request.url())) clerkRequest = true;
	});
	await page.route('**/s/public-token/visit', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ viewCount: 1 }) });
	});
	await page.route('**/s/public-token/info', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				name: 'shared-photo.png',
				sizeBytes: 1_234,
				preview: {
					url: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/6xkAAAAASUVORK5CYII=',
					expiresAt: new Date(Date.now() + 300_000).toISOString(),
					contentType: 'image/png',
					mediaKind: 'IMAGE'
				}
			})
		});
	});

	await page.goto('/s/public-token');
	await expect(page.getByText('Chmura Blokserwis', { exact: true })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'shared-photo.png' })).toBeVisible();
	await expect(page.getByRole('img', { name: 'shared-photo.png' })).toBeVisible();
	await expect(page.locator('form[action="/s/public-token/download"]')).toBeVisible();
	await expect(page.getByRole('button', { name: 'Pobierz' })).toBeVisible();
	await expect(page.locator('html')).toHaveAttribute('lang', 'pl');
	expect(clerkRequest).toBe(false);
	await page.getByRole('link', { name: 'Otwórz Chmurę Blokserwis' }).click();
	await expect(page).toHaveURL('/');
	await expect(page.getByRole('heading', { name: 'Zaloguj się' })).toBeVisible();
});

test('unlocks a protected share by sending the password in the request body', async ({ page }) => {
	let unlocked = false;
	const unlockRequests: Array<{ url: string; body: Record<string, unknown> }> = [];
	await page.route('**/s/protected-token/visit', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ viewCount: 1 }) });
	});
	await page.route('**/s/protected-token/info', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify(unlocked
				? { name: 'private-photo.png', sizeBytes: 1234, preview: null, requiresPassword: false, maxDownloads: null, downloadCount: 0, remainingDownloads: null, downloadLimitReached: false, viewCount: 1 }
				: { name: '', sizeBytes: 0, preview: null, requiresPassword: true, maxDownloads: null, downloadCount: 0, remainingDownloads: null, downloadLimitReached: false, viewCount: 1 })
		});
	});
	await page.route('**/s/protected-token/unlock', async (route) => {
		const body = route.request().postDataJSON() as Record<string, unknown>;
		unlockRequests.push({ url: route.request().url(), body });
		unlocked = true;
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, expiresAt: new Date(Date.now() + 3_600_000).toISOString() }) });
	});

	await page.goto('/s/protected-token');
	await expect(page.getByRole('heading', { name: 'Udostępniony plik jest chroniony hasłem' })).toBeVisible();
	await page.getByLabel('Hasło').fill('sekret w ciele żądania');
	await page.getByRole('button', { name: 'Odblokuj' }).click();
	await expect(page.getByRole('heading', { name: 'private-photo.png' })).toBeVisible();
	expect(unlockRequests).toHaveLength(1);
	expect(unlockRequests[0]?.url).not.toContain('sekret');
	expect(unlockRequests[0]?.body).toMatchObject({ password: 'sekret w ciele żądania' });
	await expect(page.getByRole('button', { name: 'Pobierz' })).toBeVisible();
});

test('does not revalidate the private catalog while a public share is open', async ({ page }) => {
	await page.addInitScript(() => {
		Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: {
				user: { id: 'e2e-user' },
				session: { id: 'e2e-session', status: 'active', getToken: async () => 'e2e-token' },
				load: async () => {},
				addListener: () => () => {},
				signOut: async () => {}
			}
		});
	});
	let listEntriesCalls = 0;
	let shareDocumentRequests = 0;
	page.on('request', (request) => {
		if (request.isNavigationRequest() && new URL(request.url()).pathname === '/s/public-token')
			shareDocumentRequests++;
	});
	await page.route('http://localhost:8787/**', async (route) => {
		const request = route.request();
		if (request.method() === 'OPTIONS') {
			await route.fulfill({ status: 204 });
			return;
		}
		const method = request.url().split('/').at(-1);
		if (method === 'ListEntries') listEntriesCalls++;
		const result = method === 'GetSpaces'
			? { spaces: [{ id: 'personal', kind: 2 }] }
			: method === 'GetUploadLimits'
				? { maxUploadBytes: '100000000', canManage: false }
				: method === 'ListEntries'
					? { entries: [], nextPageToken: '' }
					: {};
		await route.fulfill({
			status: 200,
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(result)
		});
	});
	await page.route('**/s/public-token/visit', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ viewCount: 1 }) });
	});
	await page.route('**/s/public-token/info', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ name: 'public-file.txt', sizeBytes: 12, preview: null })
		});
	});

	await page.goto('/');
	await expect(page.getByRole('heading', { name: 'Moje pliki' })).toBeAttached();
	await expect.poll(() => listEntriesCalls).toBeGreaterThan(0);
	await page.evaluate(() => {
		const link = document.createElement('a');
		link.href = '/s/public-token';
		document.body.append(link);
		link.click();
	});
	await expect(page.getByRole('heading', { name: 'public-file.txt' })).toBeVisible();
	expect(shareDocumentRequests).toBe(0);
	const callsWhilePrivate = listEntriesCalls;
	await page.evaluate(() => {
		const now = Date.now;
		Date.now = () => now() + 16 * 60_000;
		window.dispatchEvent(new Event('focus'));
	});
	await expect.poll(() => listEntriesCalls).toBe(callsWhilePrivate);
});

test('loads the new file when an SPA navigation changes the public share address', async ({ page }) => {
	const requestedAddresses: string[] = [];
	await page.route('**/s/*/visit', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ viewCount: 1 }) });
	});
	await page.route('**/s/*/info', async (route) => {
		const address = new URL(route.request().url()).pathname.split('/').at(-2)!;
		requestedAddresses.push(address);
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				name: address === 'first-token' ? 'first-file.txt' : 'second-file.txt',
				sizeBytes: 12,
				preview: null
			})
		});
	});

	await page.goto('/s/first-token');
	await expect(page.getByRole('heading', { name: 'first-file.txt' })).toBeVisible();
	await page.evaluate(() => {
		const link = document.createElement('a');
		link.href = '/s/second-token';
		document.body.append(link);
		link.click();
	});
	await expect(page).toHaveURL('/s/second-token');
	await expect(page.getByRole('heading', { name: 'second-file.txt' })).toBeVisible();
	expect(requestedAddresses).toContain('second-token');
});
