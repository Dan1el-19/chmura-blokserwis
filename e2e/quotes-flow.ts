import { readFile } from 'node:fs/promises';
import { expect, type Download, type Page } from 'playwright/test';

async function checkPDF(download: Download, minimumBytes: number) {
	const path = await download.path();
	if (!path) throw new Error('PDF download did not produce a file');
	const bytes = await readFile(path);
	expect(bytes.length).toBeGreaterThanOrEqual(minimumBytes);
	expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
}

export async function runQuoteFlow(page: Page, {
	fixture, title, expectedIntroduction, minimumPDFBytes = 5, apiOrigin
}: {
	fixture: string;
	title: string;
	expectedIntroduction: string | RegExp;
	minimumPDFBytes?: number;
	apiOrigin?: string;
}): Promise<string> {
	const list = apiOrigin ? page.waitForResponse((response) =>
		response.url() === `${apiOrigin}/unisource.v2.QuoteService/ListQuotes` && response.status() === 200
	) : undefined;
	await page.goto('/wyceny');
	if (list) await list;
	await page.getByRole('button', { name: 'Nowa wycena' }).click();
	await expect(page).toHaveURL(/\/wyceny\/[0-9a-f-]{36}$/);
	const quoteId = new URL(page.url()).pathname.split('/').at(-1)!;
	await page.getByLabel('Tytuł').fill(title);
	await page.getByLabel('Klient', { exact: true }).fill('Przykładowy klient');
	await page.getByRole('button', { name: 'Zapisz szkic' }).click();
	await expect(page.getByText('Szkic zapisany')).toBeVisible();

	await page.getByLabel('Plik XLSX').setInputFiles(fixture);
	await page.getByRole('button', { name: 'Prześlij arkusz' }).click();
	await expect(page.getByText('Zlecono analizę arkusza.')).toBeVisible();
	await page.reload();
	const imported = page.getByRole('group', { name: 'Import XLSX' });
	await expect(imported.getByText(/Suma pozycji: 40\.00 PLN/)).toBeVisible();
	await imported.getByRole('button', { name: 'Zaznacz wszystkie' }).click();
	await imported.getByRole('button', { name: 'Ustaw VAT zaznaczonym' }).click();
	await imported.getByRole('button', { name: 'Zastosuj sprawdzone pozycje' }).click();
	await expect(imported.getByText('Import zapisany w szkicu.')).toBeVisible();
	await expect(page.getByRole('group', { name: 'Dane wyceny' }).getByLabel('Nazwa')).toHaveValue('Kamera');

	await page.getByRole('button', { name: 'Generuj opis AI' }).click();
	await expect(page.getByLabel('Wstęp')).toHaveValue(expectedIntroduction, { timeout: 95_000 });
	await page.getByRole('button', { name: 'Podgląd szkicu' }).click();
	await expect(page.frameLocator('iframe[title="Podgląd wyceny"]').getByText('SZKIC', { exact: true })).toBeVisible();

	await page.getByRole('button', { name: 'Generuj PDF szkicu' }).click();
	const draftLink = page.getByRole('link', { name: 'Pobierz PDF szkicu' });
	await expect(draftLink).toBeVisible({ timeout: 15_000 });
	const draftDownload = page.waitForEvent('download');
	await draftLink.click();
	await checkPDF(await draftDownload, minimumPDFBytes);

	await page.getByRole('button', { name: 'Zatwierdź wycenę' }).click();
	const number = page.getByText(/WYC\/\d{4}\/\d{4} · v1/);
	await expect(number).toBeVisible();
	const quoteNumber = (await number.innerText()).split(' · ')[0];
	await page.getByLabel('Tytuł').fill(`${title}, druga wersja`);
	await page.getByRole('button', { name: 'Zapisz zmiany', exact: true }).click();
	await expect(page.getByText(`${quoteNumber} · v2`, { exact: true })).toBeVisible();
	await page.reload();
	const newest = page.getByRole('button', { name: 'Pobierz najnowszy gotowy PDF' });
	await expect(newest).toBeVisible({ timeout: 15_000 });
	const download = page.waitForEvent('download');
	await newest.click();
	await checkPDF(await download, minimumPDFBytes);
	await expect(page.getByText(/^v1 ·/)).toBeVisible();
	await expect(page.getByText(/^v2 ·/)).toBeVisible();

	await page.getByRole('button', { name: 'Archiwizuj' }).click();
	await expect(page.getByText(`${quoteNumber} · v2 · Archiwum`, { exact: true })).toBeVisible();
	await page.getByRole('link', { name: 'Wróć do wycen' }).click();
	await page.getByRole('button', { name: 'Archiwum', exact: true }).click();
	const archived = page.getByRole('link', { name: `${title}, druga wersja`, exact: false });
	await expect(archived).toBeVisible();
	await archived.click();
	await page.getByRole('button', { name: 'Przywróć' }).click();
	await expect(page.getByText(`${quoteNumber} · v2`, { exact: true })).toBeVisible();
	return quoteId;
}
