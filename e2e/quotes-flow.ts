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
	fixture, title, expectedScope, minimumPDFBytes = 5, generateAI = true
}: {
	fixture: string;
	title: string;
	expectedScope?: string | RegExp;
	minimumPDFBytes?: number;
	apiOrigin?: string;
	generateAI?: boolean;
}): Promise<string> {
 await page.goto('/wyceny/nowa');
 await page.getByLabel('Plik XLSX', { exact: true }).setInputFiles(fixture);
 await expect(page).toHaveURL(/\/wyceny\/[0-9a-f-]{36}\?step=/);
 const quoteId = new URL(page.url()).pathname.split('/').at(-1)!;
 await expect(page.getByRole('heading', { name: 'Sprawdź dane', exact: true })).toBeVisible({timeout:30000});
 await expect(page.getByRole('region',{name:'Dane wyceny'})).toContainText('Kamera');
 await page.reload();
 await expect(page.getByRole('heading',{name:'Sprawdź dane',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Edytuj',exact:true}).click();
 await page.getByLabel('Nazwa wyceny',{exact:true}).fill(title);
 await page.getByLabel('Klient',{exact:true}).fill('Przykładowy klient');
 await page.getByRole('button',{name:'Dodaj podsekcję'}).click();
 await page.getByLabel('Nagłówek podsekcji 1').fill('Prace');
 await page.getByLabel('Treść podsekcji 1').fill('Montaż kamery');
 await page.getByRole('button',{name:'Zapisz i sprawdź dane'}).click();
 if(generateAI){
  await page.getByRole('button',{name:'Tak, przygotuj opisy'}).click();
  const proposal=page.getByRole('region',{name:'Propozycja zakresu AI'});
  await expect(proposal).toBeVisible({timeout:95000});
  if(expectedScope) await expect(proposal).toContainText(expectedScope);
  await page.reload();
  await expect(proposal).toBeVisible();
  await page.getByLabel('Co chcesz zmienić?').fill('Skróć opisy.');
  const correction=page.waitForResponse(r=>r.url().endsWith('/SendQuoteAgentMessage')&&r.status()===200);
  await page.getByRole('button',{name:'Wyślij wiadomość'}).click();await correction;
  await page.getByRole('button',{name:/Zobacz rozmowę/}).click();
  await expect(page.getByRole('region',{name:'Rozmowa z asystentem AI'})).toContainText('Skróć opisy.');
  await expect(proposal).toBeVisible({timeout:30000});
  await proposal.getByRole('button',{name:'Zastosuj propozycję'}).click();
 }else await page.getByRole('button',{name:'Kontynuuj bez AI'}).click();
 await expect(page.getByText(/Liczba stron:/)).toBeVisible({timeout:30000});
 const approve=page.getByRole('button',{name:'Zatwierdź wycenę',exact:true});
 await expect(approve).toBeEnabled();await approve.click();
 const number=page.getByRole('heading',{name:/^W\/\d{3,}\/\d{4}$/});
 await expect(number).toBeVisible();const quoteNumber=await number.innerText();
 const pdf=page.getByRole('button',{name:'Pobierz PDF',exact:true});
 await expect(pdf).toBeEnabled({timeout:30000});
 const downloaded=page.waitForEvent('download');await pdf.click();await checkPDF(await downloaded,minimumPDFBytes);
 await page.getByRole('button',{name:'Edytuj wycenę',exact:true}).click();
 await page.getByLabel('Nazwa wyceny',{exact:true}).fill(`${title}, druga wersja`);
 await page.getByRole('button',{name:'Zapisz i wróć do podglądu'}).click();
 const revise=page.getByRole('button',{name:'Zatwierdź nową rewizję'});await expect(revise).toBeEnabled({timeout:30000});await revise.click();
 await expect(page.getByRole('heading',{name:quoteNumber,exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:quoteNumber,exact:true})).toBeVisible();
 await expect(pdf).toBeEnabled({timeout:30000});
 const revised=page.waitForEvent('download');await pdf.click();await checkPDF(await revised,minimumPDFBytes);
 return quoteId;
}
