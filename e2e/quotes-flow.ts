import { readFile } from 'node:fs/promises';
import { expect, type Download, type Page } from 'playwright/test';

async function checkPDF(download: Download, minimumBytes: number) {
	const path = await download.path();
	if (!path) throw new Error('PDF download did not produce a file');
	const bytes = await readFile(path);
	expect(bytes.length).toBeGreaterThanOrEqual(minimumBytes);
	expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
	return bytes;
}

export async function runQuoteFlow(page: Page, {
	fixture, title, expectedScope, minimumPDFBytes = 5, apiOrigin, generateAI = true
}: {
	fixture: string;
	title: string;
	expectedScope?: string | RegExp;
	minimumPDFBytes?: number;
	apiOrigin?: string;
	generateAI?: boolean;
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
	await expect(page.getByText('Zapisano', { exact: true }).filter({ visible: true })).toBeVisible();

	await page.getByText('Rozwiń import XLSX').click();
	await page.getByLabel('Plik XLSX').setInputFiles(fixture);
	await page.getByRole('button', { name: 'Prześlij arkusz' }).click();
	await expect(page.getByText('Zlecono analizę arkusza.')).toBeVisible();
	await page.reload();
	const imported = page.getByRole('group', { name: 'Import XLSX' });
	await expect(imported.getByText(/Suma pozycji: 40\.00 PLN/)).toBeVisible();
	await imported.getByRole('button', { name: 'Zastosuj sprawdzone pozycje' }).click();
	await expect(imported.getByText('Import zapisany w szkicu.')).toBeVisible();
	await expect(page.getByRole('group', { name: 'Dane wyceny' }).getByLabel('Nazwa pozycji 1')).toHaveValue('Kamera');

	await page.getByRole('button', { name: 'Dodaj podsekcję' }).click();
	await page.getByLabel('Nagłówek podsekcji 1').fill('Prace');
	await page.getByLabel('Treść podsekcji 1').fill('Montaż kamery');
	if (generateAI) {
		await page.getByRole('button', { name: 'Generuj opis AI' }).click();
		const proposal = page.getByRole('region', { name: 'Propozycja zakresu AI' });
		await expect(proposal).toBeVisible({ timeout: 95_000 });
		await expect(page.getByLabel('Treść podsekcji 1')).toHaveValue('Montaż kamery');
		if (expectedScope) await expect(proposal.getByText(expectedScope, { exact: true }).last()).toBeVisible();
		await proposal.getByRole('button', { name: 'Zastosuj zakres' }).click();
		if (expectedScope) await expect(page.getByLabel('Treść podsekcji 1')).toHaveValue(expectedScope);
	}

	const pdfResponse = page.waitForResponse(response => response.request().resourceType() === 'fetch' && response.headers()['content-type']?.includes('application/pdf') === true);
	await page.getByRole('button', { name: 'Podgląd szkicu' }).click();
	const previewBytes = await (await pdfResponse).body();
	await expect(page.getByText(/Liczba stron:/)).toBeVisible({ timeout: 30_000 });
	const showEdit = page.getByRole('button', { name: 'Pokaż edycję wyceny' });
	if (await showEdit.isVisible()) await showEdit.click();
	const draftLink = page.getByRole('button', { name: 'Pobierz PDF szkicu' });
	await expect(draftLink).toBeVisible({ timeout: 30_000 });
	const draftDownload = page.waitForEvent('download');
	await draftLink.click();
	const downloadedBytes = await checkPDF(await draftDownload, minimumPDFBytes);
	expect(downloadedBytes.equals(previewBytes)).toBe(true);

	await page.getByRole('button', { name: 'Zatwierdź wycenę' }).click();
	const number = page.getByText(/WYC\/\d{4}\/\d{4} · v1/);
	await expect(number).toBeVisible();
	const quoteNumber = (await number.innerText()).split(' · ')[0];
	await page.getByLabel('Tytuł').fill(`${title}, druga wersja`);
	await page.getByRole('button', { name: 'Opublikuj rewizję', exact: true }).click();
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
