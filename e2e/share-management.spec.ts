import { expect, test } from 'playwright/test';

test('lists a space and pauses, renames and removes a share', async ({ page }) => {
	let share = {id:'share-1',address:'client-link',revision:1,paused:false,viewCount:'4',downloadCount:'2',hasPassword:true};
	let deleted = false;
	await page.addInitScript(() => Object.assign(window, {__internal_ClerkUICtor:class {},Clerk:{user:{id:'shares-user'},session:{id:'session',status:'active',getToken:async ()=>'token'},load:async()=>{},addListener:()=>()=>{},signOut:async()=>{}}}));
	await page.route('http://localhost:8787/**', async route => {
		const request=route.request();
		const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS','content-type':'application/json'};
		if (request.method()==='OPTIONS') return route.fulfill({status:204,headers});
		const method=request.url().split('/').at(-1), body=request.postDataJSON() as Record<string,unknown>;
		let result:object={};
		if (method==='GetSpaces') result={spaces:[{id:'main',kind:1},{id:'personal',kind:2}]};
		if (method==='ListSpaceShares') result={shares:deleted?[]:[{share,entryId:'file-1',entryName:'Plan.pdf',entryKind:2}],nextPageToken:''};
		if (method==='UpdateShare') {share={...share,...(typeof body.paused==='boolean'?{paused:body.paused}:{}),...(body.slug?{address:String(body.slug)}:{}),revision:share.revision+1};result={share};}
		if (method==='DeleteShare') deleted=true;
		await route.fulfill({status:200,headers,body:JSON.stringify(result)});
	});
	await page.goto('/shares');
	await expect(page.getByText('Plan.pdf')).toBeVisible();
	await page.getByRole('button',{name:'Wstrzymaj'}).click();
	await expect(page.getByText(/Wstrzymany/)).toBeVisible();
	await page.getByRole('button',{name:'Zmień adres'}).click();
	await page.getByLabel('Nowy adres').fill('nowy-adres');
	await page.getByRole('button',{name:'Zapisz adres'}).click();
	await expect(page.getByText('/s/nowy-adres')).toBeVisible();
	page.once('dialog', dialog => void dialog.accept());
	await page.getByRole('button',{name:'Usuń link'}).click();
	await expect(page.getByText('Brak linków w tej przestrzeni.')).toBeVisible();
});
