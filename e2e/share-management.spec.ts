import { expect, test } from 'playwright/test';

test('lists a space and pauses, renames and removes a share', async ({ page }) => {
	let share = {id:'share-1',address:'client-link',revision:1,paused:false,viewCount:'4',downloadCount:'2',hasPassword:true};
	let deleted = false;
	let omitUpdate = false;
	await page.addInitScript(() => {
		Object.assign(window, {__internal_ClerkUICtor:class {},Clerk:{user:{id:'shares-user'},session:{id:'session',status:'active',getToken:async ()=>'token'},load:async()=>{},addListener:()=>()=>{},signOut:async()=>{}}});
		Object.defineProperty(navigator, 'clipboard', { value: { writeText: async (value: string) => {
			if ((window as unknown as { clipboardDenied?: boolean }).clipboardDenied) throw new Error('Brak dostępu do schowka');
			Object.assign(window, { copiedShareUrl: value });
		} }, configurable: true });
	});
	await page.route('http://localhost:8787/**', async route => {
		const request=route.request();
		const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS','content-type':'application/json'};
		if (request.method()==='OPTIONS') return route.fulfill({status:204,headers});
		const method=request.url().split('/').at(-1), body=request.postDataJSON() as Record<string,unknown>;
		let result:object={};
		if (method==='GetSpaces') result={spaces:[{id:'main',kind:1},{id:'personal',kind:2}]};
		if (method==='ListSpaceShares') result={shares:deleted?[]:[{share,entryId:'file-1',entryName:'Plan.pdf',entryKind:2}],nextPageToken:''};
		if (method==='UpdateShare' && !omitUpdate) {share={...share,...(typeof body.paused==='boolean'?{paused:body.paused}:{}),...(body.slug?{address:String(body.slug)}:{}),revision:share.revision+1};result={share};}
		if (method==='DeleteShare') deleted=true;
		await route.fulfill({status:200,headers,body:JSON.stringify(result)});
	});
	await page.goto('/shares');
	await expect(page.getByText('Plan.pdf')).toBeVisible();
	await page.getByRole('button', { name: 'Kopiuj link', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Skopiowano link.');
	expect(await page.evaluate(() => (window as unknown as { copiedShareUrl: string }).copiedShareUrl)).toBe('http://127.0.0.1:3100/s/client-link');
	await page.getByRole('button', { name: 'Kopiuj adres pobierania', exact: true }).click();
	await expect(page.getByRole('status')).toHaveText('Skopiowano adres pobierania.');
	expect(await page.evaluate(() => (window as unknown as { copiedShareUrl: string }).copiedShareUrl)).toBe('http://127.0.0.1:3100/s/client-link/download');
	await page.evaluate(() => Object.assign(window, { clipboardDenied: true }));
	await page.getByRole('button', { name: 'Kopiuj link', exact: true }).click();
	await expect(page.getByRole('alert')).toContainText('Nie udało się skopiować linku');
	await page.getByRole('button',{name:'Wstrzymaj'}).click();
	await expect(page.getByText(/Wstrzymany/)).toBeVisible();
	await expect(page.getByRole('status')).toHaveText('Link został wstrzymany.');
	omitUpdate = true;
	await page.getByRole('button', { name: 'Wznów' }).click();
	await expect(page.getByRole('alert')).toContainText('Usługa nie potwierdziła zmian linku');
	await expect(page.getByRole('status')).toHaveCount(0);
	omitUpdate = false;
	await page.getByRole('button',{name:'Zmień adres'}).click();
	await page.getByLabel('Nowy adres').fill('nowy-adres');
	await page.getByRole('button',{name:'Zapisz adres'}).click();
	await expect(page.getByText('/s/nowy-adres')).toBeVisible();
	await expect(page.getByRole('status')).toHaveText('Adres linku został zapisany.');
	page.once('dialog', dialog => void dialog.accept());
	await page.getByRole('button',{name:'Usuń link'}).click();
	await expect(page.getByText('Brak linków w tej przestrzeni.')).toBeVisible();
	await expect(page.getByRole('status')).toHaveText('Link został usunięty.');
});
