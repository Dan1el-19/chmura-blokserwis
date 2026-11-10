import { expect, test } from 'playwright/test';

test('finds a conflict on another page and sends the selected replacement revision', async ({ page }) => {
	const uploads: Record<string, unknown>[] = [];
	await page.addInitScript(() => Object.assign(window, {
		__internal_ClerkUICtor: class {},
		Clerk: { user: { id: 'conflict-e2e-user' }, session: { id: 'session', status: 'active', getToken: async () => 'token' }, load: async () => {}, addListener: () => () => {}, signOut: async () => {} }
	}));
	await page.route('http://localhost:8787/**', async (route) => {
		const request = route.request();
		const headers = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'POST, OPTIONS', 'content-type': 'application/json' };
		if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers });
		const method = request.url().split('/').at(-1);
		const body = request.postDataJSON() as Record<string, unknown>;
		let result: object = {};
		if (method === 'GetSpaces') result = { spaces: [{ id: 'main', kind: 1 }, { id: 'personal', kind: 2 }] };
		if (method === 'GetUploadLimits') result = { maxUploadBytes: '100000000' };
		if (method === 'ListEntries' && body.pageSize === 100) result = body.pageToken ? { entries: [{id:'original',spaceId:'main',name:'raport.txt',kind:2,revision:7}], nextPageToken:'' } : { entries: [], nextPageToken:'next' };
		if (method === 'ListEntries' && body.pageSize !== 100) result = { entries: [], nextPageToken:'' };
		if (method === 'CreateUpload') { uploads.push(body); return route.fulfill({status:409,headers,body:JSON.stringify({code:'aborted',message:'test'})}); }
		await route.fulfill({status:200,headers,body:JSON.stringify(result)});
	});
	await page.goto('/');
	await page.getByLabel('Wybierz pliki do przesłania').setInputFiles({name:'raport.txt',mimeType:'text/plain',buffer:Buffer.from('new content')});
	await expect(page.getByRole('dialog').getByText('raport.txt')).toBeVisible();
	await page.getByRole('button',{name:'Zastąp'}).click();
	await expect.poll(() => uploads.length).toBe(1);
	expect(uploads[0]).toMatchObject({spaceId:'main',name:'raport.txt',replaceEntryId:'original',replaceExpectedRevision:7});
});

test('resolves a late name conflict after navigating away without changing the upload destination', async ({page}, testInfo) => {
	const attempts:Record<string,unknown>[]=[];
	let collision=false;
	await page.addInitScript(()=>Object.assign(window,{__internal_ClerkUICtor:class {},Clerk:{user:{id:'late-conflict-user'},session:{id:'session',status:'active',getToken:async ()=>'token'},load:async()=>{},addListener:()=>()=>{},signOut:async()=>{}}}));
	await page.route('http://localhost:8787/**',async route=>{
		const request=route.request();
		const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS','content-type':'application/json'};
		if(request.method()==='OPTIONS') return route.fulfill({status:204,headers});
		const method=request.url().split('/').at(-1), body=request.postDataJSON() as Record<string,unknown>;
		let result:object={};
		if(method==='GetSpaces') result={spaces:[{id:'main',kind:1},{id:'personal',kind:2}]};
		if(method==='GetUploadLimits') result={maxUploadBytes:'100000000'};
		if(method==='ListEntries') result={entries:collision&&body.spaceId==='main'?[{id:'existing',spaceId:'main',name:'late.txt',kind:2,revision:5}]:[],nextPageToken:''};
		if(method==='CreateUpload') {
			attempts.push(body);
			if(attempts.length===1) {collision=true;return route.fulfill({status:409,headers,body:JSON.stringify({code:'already_exists',message:'ALREADY_EXISTS'})});}
			return route.fulfill({status:500,headers,body:JSON.stringify({code:'internal',message:'test end'})});
		}
		return route.fulfill({status:200,headers,body:JSON.stringify(result)});
	});
	await page.goto('/');
	await page.getByLabel('Wybierz pliki do przesłania').setInputFiles({name:'late.txt',mimeType:'text/plain',buffer:Buffer.from('new')});
	await expect(page.getByRole('region',{name:'Transfery'}).getByRole('button',{name:'Zastąp'})).toBeVisible();
	if (testInfo.project.name === 'mobile') await page.getByRole('button',{name:'Przełącz menu'}).click();
	await page.getByRole(testInfo.project.name === 'mobile' ? 'navigation' : 'complementary').getByRole('link',{name:'Pliki prywatne'}).click();
	await expect(page.getByRole('heading',{name:'Pliki prywatne'})).toBeVisible();
	await page.getByRole('region',{name:'Transfery'}).getByRole('button',{name:'Zastąp'}).click();
	await expect.poll(()=>attempts.length).toBe(2);
	expect(attempts[1]).toMatchObject({spaceId:'main',name:'late.txt',replaceEntryId:'existing',replaceExpectedRevision:5});
});
