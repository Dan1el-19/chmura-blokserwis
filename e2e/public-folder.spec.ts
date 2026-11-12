import { expect, test } from 'playwright/test';

test('browses a shared folder and opens a file preview', async ({page}) => {
	await page.route('**/s/folder-test/visit', route => route.fulfill({status:200,json:{viewCount:1}}));
	await page.route('**/s/folder-test/info*', route => {
		const url=new URL(route.request().url());
		return route.fulfill({status:200,json:url.searchParams.has('file')?{name:'file.txt',sizeBytes:3,preview:null,requiresPassword:false,maxDownloads:null,downloadCount:0,viewCount:1}:{kind:'FOLDER',name:'Root',requiresPassword:false,maxDownloads:null,downloadCount:0,viewCount:1}});
	});
	await page.route('**/s/folder-test/folder*',route=>{
		const url=new URL(route.request().url());
		const nested=url.searchParams.get('folder')==='child';
		return route.fulfill({status:200,json:{breadcrumbs:nested?[{id:'root',name:'Root'},{id:'child',name:'Child'}]:[{id:'root',name:'Root'}],entries:nested?[{id:'file-1',name:'file.txt',kind:'FILE',sizeBytes:3}]:[{id:'child',name:'Child',kind:'FOLDER',sizeBytes:null}],nextPageToken:''}});
	});
	await page.goto('/s/folder-test');
	await page.getByRole('button',{name:'📁 Child'}).click();
	await expect(page.getByRole('navigation',{name:'Ścieżka folderu'}).getByText('Child')).toBeVisible();
	await page.getByRole('button',{name:'📄 file.txt'}).click();
	await expect(page.getByRole('heading',{name:'file.txt'})).toBeVisible();
	await expect(page.locator('form[action="/s/folder-test/download"] input[name="file"]')).toHaveValue('file-1');
});

test('does not replace a newer preview with an older delayed response', async ({page}) => {
	let release!: () => void;
	const gate = new Promise<void>(resolve => {release=resolve;});
	let requests=0;
	let delivered!: () => void;
	const oldDelivered = new Promise<void>(resolve => {delivered=resolve;});
	await page.route('**/s/race-folder/visit', route=>route.fulfill({status:200,json:{viewCount:1}}));
	await page.route('**/s/race-folder/folder*', route=>route.fulfill({status:200,json:{breadcrumbs:[{id:'root',name:'Root'}],entries:[{id:'image-1',name:'image.png',kind:'FILE',sizeBytes:3}],nextPageToken:''}}));
	await page.route('**/s/race-folder/info*', async route=>{
		const url=new URL(route.request().url());
		if (!url.searchParams.has('file')) return route.fulfill({status:200,json:{kind:'FOLDER',name:'Root',requiresPassword:false,maxDownloads:null,downloadCount:0,viewCount:1}});
		const index=++requests;
		if(index===1) await gate;
		await route.fulfill({status:200,json:{name:'image.png',sizeBytes:3,preview:{url:`https://preview.example/${index}.png`,contentId:`version-${index}`,expiresAt:new Date(Date.now()+60_000).toISOString()}}});
		if (index===1) delivered();
	});
	await page.route('https://preview.example/**',route=>route.fulfill({status:200,contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aZ8sAAAAASUVORK5CYII=','base64')}));
	await page.goto('/s/race-folder');
	await page.getByRole('button',{name:'📄 image.png'}).click();
	await expect.poll(()=>requests).toBe(1);
	await page.getByRole('button',{name:'Wróć do folderu'}).click();
	await page.getByRole('button',{name:'📄 image.png'}).click();
	await expect(page.getByRole('img',{name:'image.png'})).toHaveAttribute('src','https://preview.example/2.png');
	release();
	await oldDelivered;
	await expect(page.getByRole('img',{name:'image.png'})).toHaveAttribute('src','https://preview.example/2.png');
});

test('keeps a public audio preview and its actions inside a narrow viewport', async ({ page }) => {
	await page.setViewportSize({ width: 320, height: 740 });
	let visits = 0;
	await page.route('**/s/audio-folder/visit', route => { visits++; return route.fulfill({ status: 200, json: { viewCount: 1 } }); });
	await page.route('**/s/audio-folder/folder*', route => route.fulfill({ status: 200, json: {
		breadcrumbs: [{ id: 'root', name: 'Bardzo długa nazwa folderu publicznego' }],
		entries: [{ id: 'audio-1', name: 'bardzo-dluga-nazwa-nagrania-testowego.mp3', kind: 'FILE', sizeBytes: 3 }], nextPageToken: ''
	} }));
	await page.route('**/s/audio-folder/info*', route => {
		const url = new URL(route.request().url());
		return route.fulfill({ status: 200, json: url.searchParams.has('file')
			? { preview: { url: 'https://preview.example/audio.mp3', expiresAt: new Date(Date.now() + 60_000).toISOString() } }
			: { kind: 'FOLDER', name: 'Folder publiczny', requiresPassword: false, maxDownloads: null, downloadCount: 0, viewCount: 1 } });
	});
	await page.route('https://preview.example/**', route => route.fulfill({ status: 200, contentType: 'audio/mpeg', body: '' }));
	await page.goto('/s/audio-folder');
	await page.getByRole('button', { name: /bardzo-dluga-nazwa-nagrania/ }).click();
	const audio = page.getByLabel('Odtwarzacz audio: bardzo-dluga-nazwa-nagrania-testowego.mp3');
	await expect(audio).toBeVisible();
	const box = await audio.boundingBox();
	expect(box && box.x >= 0 && box.x + box.width <= 320).toBe(true);
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
	await expect(page.getByRole('button', { name: 'Pobierz', exact: true })).toBeInViewport();
	expect(visits).toBe(1);
});
