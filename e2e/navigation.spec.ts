import { test, expect } from 'playwright/test';

// Real router, layout, auth lifecycle and XHR; external Clerk/RPC/storage are controlled fixtures.
test('preserves folders, pages and uploads while navigating through the application', async ({
	page,
	context
}, testInfo) => {
	const errors: string[] = [];
	page.on('pageerror', (error) => errors.push(error.message));
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
	const folder = {
		id: 'docs',
		spaceId: 'personal',
		kind: 1,
		name: 'Dokumenty',
		revision: 1,
		sizeBytes: '55'
	};
	const files = Array.from({ length: 55 }, (_, index) => ({
		id: `file-${index}`,
		spaceId: 'personal',
		parentId: 'docs',
		kind: 2,
		name: `Plik ${String(index).padStart(2, '0')}.txt`,
		sizeBytes: '1',
		revision: 1,
		storageLocation: 1
	}));
	const uploaded: typeof files = [];
	const jobs = new Map<
		string,
		{ spaceId: string; parentId?: string; name: string; uploadMode: string; sizeBytes: string }
	>();
	const counts: Record<string, number> = {};
	let release!: () => void;
	const heldPut = new Promise<void>((resolve) => {
		release = resolve;
	});
	let putStarted = false;
	let releaseFolder!: () => void;
	const heldFolder = new Promise<void>((resolve) => {
		releaseFolder = resolve;
	});
	let holdFolder = true;
	await page.route('**/__test-upload/**', async (route) => {
		putStarted = true;
		await heldPut;
		await route.fulfill({ status: 200, body: '' });
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
		counts[method] = (counts[method] ?? 0) + 1;
		const body = request.postDataJSON();
		let result: object = {};
		switch (method) {
			case 'GetSpaces':
				result = {
					spaces: [
						{ id: 'personal', kind: 2 },
						{ id: 'main', kind: 1 }
					]
				};
				break;
			case 'GetUploadLimits':
				result = { maxUploadBytes: '100000000', canManage: false };
				break;
			case 'GetEntry':
				result = { entry: folder };
				break;
			case 'ListTrash':
				result = { items: [], nextPageToken: '' };
				break;
			case 'ListEntries': {
				if (body.parentId === 'docs' && holdFolder) {
					holdFolder = false;
					await heldFolder;
				}
				const all =
					body.spaceId === 'personal'
						? body.parentId === 'docs'
							? [...files, ...uploaded]
							: [folder]
						: [];
				const offset = body.pageToken ? Number(body.pageToken) : 0;
				result = {
					entries: all.slice(offset, offset + 50),
					nextPageToken: all.length > offset + 50 ? String(offset + 50) : ''
				};
				break;
			}
			case 'CreateUpload': {
				const id = `upload-${jobs.size + 1}`;
				jobs.set(id, body);
				result = {
					session: {
						id,
						state: 1,
						attemptId: `attempt-${id}`,
						attemptNumber: 1,
						storageLocation: body.uploadMode === 'UPLOAD_MODE_RUSTFS' ? 2 : 1
					},
					target: { url: `http://127.0.0.1:3100/__test-upload/${id}`, headers: {} }
				};
				break;
			}
			case 'CompleteUpload': {
				const job = jobs.get(body.uploadId)!;
				const entry = {
					id: body.uploadId,
					spaceId: job.spaceId,
					parentId: job.parentId ?? '',
					name: job.name,
					kind: 2,
					sizeBytes: job.sizeBytes,
					revision: 1,
					storageLocation: job.uploadMode === 'UPLOAD_MODE_RUSTFS' ? 2 : 1
				};
				uploaded.push(entry);
				result = { entry };
				break;
			}
			case 'GetMe':
			case 'CancelUpload':
				break;
			default:
				throw new Error(`Unexpected RPC ${method}`);
		}
		await route.fulfill({ status: 200, headers, body: JSON.stringify(result) });
	});
	function waitForRpc(method: string, matches: (body: Record<string, unknown>) => boolean = () => true) {
		return page.waitForResponse((response) => {
			const request = response.request();
			if (!request.url().endsWith(`/${method}`)) return false;
			return matches(request.postDataJSON() as Record<string, unknown>);
		});
	}
	const mobile = testInfo.project.name === 'mobile';
	async function navigate(label: string): Promise<void> {
		if (mobile) await page.getByRole('button', { name: 'Przełącz menu' }).click();
		await page
			.getByRole(
				mobile ? 'navigation' : 'complementary',
				mobile ? { name: 'Nawigacja mobilna' } : {}
			)
			.getByRole('link', { name: label, exact: true })
			.click();
		const paths: Record<string, string> = { 'Pliki wspólne': '/', 'Pliki prywatne': '/personal', Kosz: '/trash', Ustawienia: '/settings' };
		await expect.poll(() => new URL(page.url()).pathname).toBe(paths[label]);
		if (mobile)
			await expect(page.getByRole('navigation', { name: 'Nawigacja mobilna' })).toBeHidden();
	}
	function contentFile(name: string) {
		return mobile
			? page.getByRole('button', { name: `Podgląd ${name}`, exact: true })
			: page.getByRole('table').getByText(name, { exact: true });
	}
	const startupResponses = Promise.all([
		waitForRpc('GetMe'),
		waitForRpc('GetSpaces'),
		waitForRpc('ListEntries', (body) => !body.parentId)
	]);
	await page.goto('/personal');
	for (const response of await startupResponses) {
		expect(response.status()).toBe(200);
		expect(response.request().headers()['authorization']).toBe('Bearer e2e-token');
	}
	await expect(page.getByRole('heading', { name: 'Pliki prywatne' })).toBeAttached();
	await expect(page.getByRole('button', { name: 'Nowy folder' })).toBeEnabled();
	await page.screenshot({ path: `.cache/e2e-files-${testInfo.project.name}.png` });
	await page.getByRole('button', { name: 'Nowy folder' }).click();
	await expect(page.getByRole('dialog')).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).toBeHidden();
	await expect(page.getByRole('button', { name: 'Nowy folder' })).toBeFocused();
	if (mobile) await page.getByRole('button', { name: 'Otwórz folder Dokumenty' }).click();
	else await page.getByRole('button', { name: 'Dokumenty', exact: true }).click();
	await expect(page).toHaveURL(/folder=docs/);
	await expect(page.getByRole('status', { name: 'Ładowanie plików' }).first()).toBeVisible();
	if (mobile)
		await expect(page.getByRole('button', { name: 'Otwórz folder Dokumenty' })).toBeHidden();
	else
		await expect(
			page.getByRole('table').getByRole('button', { name: 'Dokumenty', exact: true })
		).toBeHidden();
	releaseFolder();
	await page.getByRole('button', { name: 'Pokaż więcej' }).click();
	await expect(contentFile('Plik 54.txt')).toBeVisible();
	const scroll = page.locator('main');
	await scroll.evaluate((element) => {
		element.scrollTop = 600;
	});
	await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
	const listCalls = counts.ListEntries;
	await page.clock.setFixedTime(new Date(Date.now() + 14 * 60_000));
	await navigate('Pliki wspólne');
	await expect(page.getByRole('heading', { name: 'Pliki wspólne' })).toBeAttached();
	await navigate('Pliki prywatne');
	await expect(page).toHaveURL(/folder=docs/);
	await expect(contentFile('Plik 54.txt')).toBeVisible();
	await expect.poll(() => scroll.evaluate((element) => element.scrollTop)).toBeGreaterThan(100);
	expect(counts.ListEntries).toBe(listCalls + 1);
	await page.getByLabel('Wybierz pliki do przesłania').setInputFiles([
		{ name: 'pierwszy.txt', mimeType: 'text/plain', buffer: Buffer.from('one') },
		{ name: 'drugi.txt', mimeType: 'text/plain', buffer: Buffer.from('two') }
	]);
	await expect.poll(() => putStarted).toBe(true);
	await expect(page.getByRole('region', { name: 'Transfery' })).toBeVisible();
	await navigate('Pliki wspólne');
	await expect(page.getByRole('region', { name: 'Transfery' })).toBeVisible();
	await navigate('Kosz');
	await expect(page.getByRole('region', { name: 'Transfery' })).toBeVisible();
	await navigate('Ustawienia');
	await navigate('Kosz');
	expect(counts.ListTrash).toBe(1);
	await navigate('Ustawienia');
	if (mobile) await page.getByRole('button', { name: 'Przełącz menu' }).click();
	const links = page
		.getByRole(mobile ? 'navigation' : 'complementary', mobile ? { name: 'Nawigacja mobilna' } : {})
		.getByRole('link');
	expect((await links.allTextContents()).map((text) => text.trim())).toEqual(
		mobile
			? ['Pliki wspólne', 'Pliki prywatne', 'Udostępnienia', 'Kosz', 'Ustawienia']
			: ['Chmura Blokserwis', 'Pliki wspólne', 'Pliki prywatne', 'Udostępnienia', 'Kosz', 'Ustawienia']
	);
	if (mobile) {
		await page.getByRole('button', { name: 'Przełącz menu' }).click();
		await expect(page.getByRole('navigation', { name: 'Nawigacja mobilna' })).toBeHidden();
	}
	await page.getByRole('combobox', { name: 'Domyślne miejsce przechowywania' }).selectOption('2');
	if (mobile) {
		await page.getByRole('button', { name: 'Przełącz menu' }).click();
		await page.getByRole('button', { name: 'Wyloguj', exact: true }).click({ trial: true });
		await page.getByRole('button', { name: 'Przełącz menu' }).click();
		await expect(page.getByRole('navigation', { name: 'Nawigacja mobilna' })).toBeHidden();
	}
	await page.screenshot({ path: `.cache/e2e-settings-${testInfo.project.name}.png` });
	const transfer = page.getByRole('region', { name: 'Transfery' });
	await expect(transfer.getByText('pierwszy.txt', { exact: true })).toBeVisible();
	await transfer.getByRole('button', { name: 'Zwiń', exact: true }).click();
	const background = await context.newPage();
	await background.goto('about:blank');
	await page.bringToFront();
	await background.close();
	release();
	await expect.poll(() => counts.CompleteUpload).toBe(2);
	await transfer.getByRole('button', { name: 'Rozwiń', exact: true }).click();
	await expect(transfer.getByText('Przesłano', { exact: true })).toHaveCount(2);
	await navigate('Pliki prywatne');
	await expect(page).toHaveURL(/folder=docs/);
	await expect(contentFile('pierwszy.txt')).toBeVisible();
	await expect(contentFile('drugi.txt')).toBeVisible();
	expect([...jobs.values()].map((job) => [job.spaceId, job.parentId, job.uploadMode])).toEqual([
		['personal', 'docs', 'UPLOAD_MODE_AUTO'],
		['personal', 'docs', 'UPLOAD_MODE_AUTO']
	]);
	expect(counts.GetMe).toBe(1);
	expect(counts.GetSpaces).toBe(1);
	expect(counts.GetUploadLimits).toBe(1);
	await expect(transfer).toBeHidden({ timeout: 7000 });
	expect(errors).toEqual([]);
});
