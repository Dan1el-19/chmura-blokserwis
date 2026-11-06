import { randomUUID } from 'node:crypto';
import { expect, test } from 'playwright/test';
import { runQuoteFlow } from './quotes-flow.js';

const enabled = process.env.E2E_QUOTES_LIVE === '1';
test.use({ trace: 'off', screenshot: 'off', video: 'off' });

function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`Missing ${name} for quotes acceptance`);
	return value;
}

function acceptanceOrigin(name: string, production: string): string {
	const url = new URL(required(name));
	if (url.origin === production || url.protocol !== 'https:' || url.href !== `${url.origin}/`) {
		throw new Error(`${name} must be a dedicated HTTPS acceptance origin`);
	}
	return url.origin;
}

test('accepts live XLSX to PDF and rejects a valid session outside Blokserwis', async ({ browser, request }) => {
	test.skip(!enabled, 'Set E2E_QUOTES_LIVE=1 for isolated live acceptance.');
	test.setTimeout(240_000);
	const cloud = acceptanceOrigin('E2E_BASE_URL', 'https://chmura.blokserwis.pl');
	const api = acceptanceOrigin('PUBLIC_QUOTES_API_URL', 'https://api.unisource.pl');
	const fixture = required('E2E_QUOTES_FIXTURE');
	const memberState = required('E2E_QUOTES_MEMBER_STATE');
	const outsiderState = required('E2E_QUOTES_OUTSIDER_STATE');
	if (memberState === outsiderState) throw new Error('Use different member and outsider sessions');

	const member = await browser.newContext({ baseURL: cloud, storageState: memberState });
	const outsider = await browser.newContext({ baseURL: cloud, storageState: outsiderState });
	try {
		const page = await member.newPage();
		const quoteId = await runQuoteFlow(page, {
			fixture,
			title: `Oferta odbiorowa ${randomUUID().slice(0, 8)}`,
			expectedIntroduction: /\S/,
			minimumPDFBytes: 1000,
			apiOrigin: api
		});
		await page.getByRole('button', { name: 'Archiwizuj' }).click();
		await expect(page.getByText(/ · Archiwum$/)).toBeVisible();
		const other = await outsider.newPage();
		const rejected = other.waitForResponse((response) =>
			response.url() === `${api}/unisource.v2.QuoteService/ListQuotes` && response.status() === 403
		);
		await other.goto('/wyceny');
		const denial = await rejected;
		const authorization = await denial.request().headerValue('authorization');
		if (!authorization?.startsWith('Bearer ')) throw new Error('Outside user did not send a Clerk session');
		await expect(other.getByRole('alert')).toBeVisible();

		for (const method of ['GetQuote', 'GetImportResult', 'GetQuoteOperation', 'GetQuotePdf']) {
			const response = await request.post(`${api}/unisource.v2.QuoteService/${method}`, {
				headers: { authorization, origin: cloud, 'content-type': 'application/json' },
				data: { quoteId }
			});
			expect(response.status(), method).toBe(403);
			const body: unknown = await response.json();
			expect(body).toMatchObject({ code: 'permission_denied' });
		}
	} finally {
		await Promise.all([member.close(), outsider.close()]);
	}
});
