import { runQuoteFlow } from './quotes-flow.js';
import { expect, test } from 'playwright/test';

const fixture = process.env.E2E_QUOTES_FIXTURE;
const apiUrl = process.env.PUBLIC_QUOTES_API_URL;
const runIntegrated = process.env.E2E_QUOTES_INTEGRATED === '1';

test.beforeEach(async ({ page }) => {
	test.skip(!runIntegrated || !fixture || !apiUrl, 'Run through the isolated UniSourceGO quotes integration test.');
	test.setTimeout(150_000);
	const origin = new URL(apiUrl!).origin;
	expect(new URL(origin).hostname).toBe('127.0.0.1');

	await page.addInitScript(() => {
		Object.assign(window, {
			__internal_ClerkUICtor: class {},
			Clerk: {
				user: { id: 'quotes-e2e-user' },
				session: { id: 'quotes-e2e-session', status: 'active', getToken: async () => 'quotes-e2e-token' },
				load: async () => {},
				addListener: () => () => {},
				signOut: async () => {}
			}
		});
	});
	await page.route('http://localhost:8787/**', async (route) => {
		const headers = {
			'access-control-allow-origin': '*',
			'access-control-allow-headers': '*',
			'access-control-allow-methods': 'POST, OPTIONS',
			'content-type': 'application/json'
		};
		const method = route.request().url().split('/').at(-1);
		if (route.request().method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
		const body = method === 'GetSpaces' ? { spaces: [{ id: 'personal', kind: 2 }] } : {};
		return route.fulfill({ status: 200, headers, json: body });
	});

});

for (const generateAI of [true, false]) test(`imports XLSX, resumes and downloads revisions (${generateAI ? 'AI' : 'without AI'})`, async ({ page }) => {
	await runQuoteFlow(page, {
		fixture: fixture!, title: 'Oferta E2E', expectedScope: 'Montaż kamery',
		generateAI
	});
});


test('creates a manual quotation and approves a real PDF without AI', async ({ page }) => {
 await page.goto('/wyceny/nowa');
 await page.getByText('Opcje zaawansowane', { exact: true }).click();
 await page.getByRole('button', { name: 'Wprowadź dane ręcznie' }).click();
 await page.getByLabel('Nazwa wyceny', { exact: true }).fill('Ręczna wycena E2E');
 await page.getByLabel('Klient', { exact: true }).fill('Klient ręczny');
 await page.getByRole('button', { name: 'Dodaj pozycję', exact: true }).click();
 await page.getByLabel('Nazwa pozycji 1', { exact: true }).fill('Przycisk wyjścia');
 await page.getByLabel('Ilość pozycji 1', { exact: true }).fill('2');
 await page.getByLabel('Cena brutto pozycji 1', { exact: true }).fill('25');
 await page.getByRole('button', { name: 'Zapisz i sprawdź dane' }).click();
 await expect(page.getByRole('region', { name: 'Pozycje z arkusza' })).toContainText('50,00 zł');
 await page.getByRole('button', { name: 'Dalej: dane wyceny' }).click();
 await page.getByRole('button', { name: 'Kontynuuj bez AI' }).click();
 const approve = page.getByRole('button', { name: 'Zatwierdź wycenę', exact: true });
 await expect(approve).toBeEnabled({ timeout: 30000 });
 await approve.click();
 await expect(page.getByRole('heading', { name: /^W\/\d{3,}\/\d{4}$/ })).toBeVisible();
 await expect(page.getByRole('button', { name: 'Pobierz PDF', exact: true })).toBeEnabled({ timeout: 30000 });
});
