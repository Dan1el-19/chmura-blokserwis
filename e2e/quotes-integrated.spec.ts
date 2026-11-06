import { runQuoteFlow } from './quotes-flow.js';
import { expect, test } from 'playwright/test';

const fixture = process.env.E2E_QUOTES_FIXTURE;
const apiUrl = process.env.PUBLIC_QUOTES_API_URL;
const runIntegrated = process.env.E2E_QUOTES_INTEGRATED === '1';

test('imports XLSX, resumes after reload and downloads published revisions through UniSourceGO', async ({ page }) => {
	test.skip(!runIntegrated || !fixture || !apiUrl, 'Run through the isolated UniSourceGO quotes integration test.');
	test.setTimeout(75_000);
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

	await runQuoteFlow(page, { fixture: fixture!, title: 'Oferta E2E', expectedIntroduction: 'Wstęp' });
});
