import {create,fromBinary,toBinary,type DescMessage,type MessageInitShape} from '@bufbuild/protobuf';
import {expect,test} from 'playwright/test';
import * as pb from '../src/lib/gen/unisource/v2/quotes_pb.js';
function pdfFixture(): Buffer {
	const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>', '<< /Length 44 >>\nstream\nBT /F1 18 Tf 40 750 Td (Hello PDF) Tj ET\nendstream', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
	let source = '%PDF-1.4\n'; const offsets = [0];
	objects.forEach((object, i) => { offsets.push(source.length); source += `${i + 1} 0 obj\n${object}\nendobj\n`; });
	const xref = source.length; source += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
	source += offsets.slice(1).map((n) => `${String(n).padStart(10, '0')} 00000 n \n`).join('');
	return Buffer.from(source + `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
}


for(const width of [390,1440]) test(`agent correction to approved PDF at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await page.addInitScript(()=>Object.assign(window,{__internal_ClerkUICtor:class{},Clerk:{user:{id:'member'},session:{id:'session',status:'active',getToken:async()=>'token'},load:async()=>{},addListener:()=>()=>{},signOut:async()=>{}}}));
 await page.route('http://localhost:8787/**',r=>r.fulfill({headers:{'access-control-allow-origin':'*'},json:{}}));
 const quote=create(pb.QuoteSchema,{id:'agent-e2e',draftVersion:1n,draft:{title:'Drużynowa',client:'Dom dziecka',documentDate:'2026-11-16',documentSchemaVersion:2,priceMode:pb.QuotePriceMode.GROSS,lines:[{name:'Zwora 600 SL',quantity:'1',unitPrice:'330'}]}});
 let turn=0;let applied=false;let published=false;let watched=false;let releasePublishedPdf=false;let publishedPdfRequests=0;
 const methods:string[]=[];const proposalDownloads:string[]=[];
 const operation=()=>create(pb.GetQuoteOperationResponseSchema,{operationId:`op-${turn}`,draftVersion:1n,status:watched?'succeeded':'running',partialText:watched?'':'Piszę opis zwory',lastEventSequence:1n,events:[{sequence:1n,kind:'search',text:'Sprawdzam źródło producenta',url:'https://example.com/model',title:'Producent'}],proposedLineTexts:watched?[{lineIndex:0,name:'Zwora 600 SL',description:turn===1?'Zwora elektromagnetyczna do kontroli dostępu.':'Zwora do kontroli dostępu.'}]:[]});
 await page.route('http://localhost:8788/**',async route=>{
  const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'POST, OPTIONS'};
  if(route.request().method()==='OPTIONS')return route.fulfill({status:204,headers});
  const method=route.request().url().split('/').at(-1)!;methods.push(method);
  const reply=async<S extends DescMessage>(schema:S,value:MessageInitShape<S>)=>route.fulfill({headers:{...headers,'content-type':'application/proto'},body:Buffer.from(toBinary(schema,create(schema,value)))});
  if(method==='GetQuote')return reply(pb.GetQuoteResponseSchema,{quote});
  if(method==='SaveQuoteWorkflow'){
   const req=fromBinary(pb.SaveQuoteWorkflowRequestSchema,route.request().postDataBuffer()!);
   quote.workflow=create(pb.QuoteWorkflowStateSchema,{...req.workflow,version:req.expectedVersion+1n});return reply(pb.SaveQuoteWorkflowResponseSchema,{workflow:quote.workflow});
  }
  if(method==='GetQuoteConversation')return reply(pb.GetQuoteConversationResponseSchema,{messages:turn?[{id:1n,role:'assistant',text:'Przygotowałem propozycję.'}]:[]});
  if(method==='GenerateQuoteText'||method==='SendQuoteAgentMessage'){
   if(method==='SendQuoteAgentMessage'){const req=fromBinary(pb.SendQuoteAgentMessageRequestSchema,route.request().postDataBuffer()!);expect(req.message).toBe('Skróć opis');}
   turn++;watched=false;return reply(method==='SendQuoteAgentMessage'?pb.SendQuoteAgentMessageResponseSchema:pb.GenerateQuoteTextResponseSchema,{operationId:`op-${turn}`});
  }
  if(method==='GetQuoteOperation'&&turn)return reply(pb.GetQuoteOperationResponseSchema,operation());
  if(method==='WatchQuoteOperation'){
   const partial=toBinary(pb.WatchQuoteOperationResponseSchema,create(pb.WatchQuoteOperationResponseSchema,{operation:operation()}));
   watched=true;const final=toBinary(pb.WatchQuoteOperationResponseSchema,create(pb.WatchQuoteOperationResponseSchema,{operation:operation()}));
   const envelope=(bytes:Uint8Array,flag=0)=>{const size=Buffer.alloc(5);size[0]=flag;size.writeUInt32BE(bytes.length,1);return Buffer.concat([size,Buffer.from(bytes)]);};
   return route.fulfill({headers:{...headers,'content-type':'application/connect+proto'},body:Buffer.concat([envelope(partial),envelope(final),envelope(Buffer.from('{}'),2)])});
  }
  if(method==='ApplyQuoteText'){
   const req=fromBinary(pb.ApplyQuoteTextRequestSchema,route.request().postDataBuffer()!);expect(req.applyLineTexts).toBe(true);expect(req.expectedVersion).toBe(1n);
   expect(quote.draft!.lines[0].description).toBe('');quote.draft!.lines[0].description='Zwora do kontroli dostępu.';quote.draftVersion=2n;applied=true;return reply(pb.ApplyQuoteTextResponseSchema,{quote});
  }
  if(method==='GetQuotePdf'){
   const request=fromBinary(pb.GetQuotePdfRequestSchema,route.request().postDataBuffer()!);
   if(request.revision)publishedPdfRequests++;
   const proposalId=request.proposalOperationId||(!request.revision&&applied?'op-2':'');
   return reply(pb.GetQuotePdfResponseSchema,{status:request.revision&&!releasePublishedPdf?'queued':'succeeded',url:request.revision&&!releasePublishedPdf?'':proposalId?`https://pdf.example/${proposalId}.pdf`:'https://pdf.example/quote.pdf',revision:request.revision,draftVersion:request.revision?0n:request.proposalOperationId?1n:quote.draftVersion,templateVersion:'4',proposalOperationId:proposalId});
  }
  if(method==='ApproveQuote'){
   expect(applied).toBe(true);expect(quote.draft!.lines[0].unitPrice).toBe('330');expect(quote.draft!.lines[0].quantity).toBe('1');
   quote.number='W/001/2026';quote.currentRevision=1n;published=true;return reply(pb.ApproveQuoteResponseSchema,{quote});
  }
  if(method==='ListQuoteRevisions')return reply(pb.ListQuoteRevisionsResponseSchema,{revisions:[]});
  return route.fulfill({status:404,headers:{...headers,'content-type':'application/json'},json:{code:'not_found',message:'missing'}});
 });
 await page.route('https://pdf.example/**',r=>{const name=r.request().url().split('/').at(-1)!.replace('.pdf','');if(name.startsWith('op-'))proposalDownloads.push(name);return r.fulfill({headers:{'access-control-allow-origin':'*','content-type':'application/pdf'},body:pdfFixture()});});
 await page.goto('/wyceny/agent-e2e');
 await expect(page.getByRole('heading',{name:'Sprawdź dane'})).toBeVisible();
 await page.getByRole('button',{name:'Dalej: dane wyceny'}).click();
 await expect(page.getByRole('heading',{name:'Dane wyceny',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Tak, przygotuj opisy'}).click();
 await expect(page.getByLabel('Proponowane opisy pozycji')).toContainText('Zwora elektromagnetyczna do kontroli dostępu.');
 expect(quote.draft!.lines[0].description).toBe('');
 await page.getByLabel('Co chcesz zmienić?').fill('Skróć opis');await page.getByRole('button',{name:'Wyślij wiadomość'}).click();
 await expect(page.getByLabel('Proponowane opisy pozycji')).toContainText('Zwora do kontroli dostępu.');
 await page.screenshot({path:`/tmp/quotes-agent-${width}.png`,fullPage:true});
 await expect.poll(()=>proposalDownloads.includes('op-2')).toBe(true);
 await page.locator('.wizard-header').getByRole('button',{name:'Zastosuj propozycję'}).click();
 await expect(page.getByRole('heading',{name:'Podgląd i zatwierdzenie'})).toBeVisible();
 await expect(page.locator('.textLayer')).toContainText('Hello PDF');
 expect(proposalDownloads.filter(id=>id==='op-2')).toHaveLength(1);
 await page.getByRole('button',{name:'Edytuj',exact:true}).click();
 await expect(page.getByLabel('Nazwa wyceny')).toBeVisible();
 await page.screenshot({path:`/tmp/quotes-editor-${width}.png`,fullPage:true});
 await page.getByRole('button',{name:'Zapisz i wróć do podglądu'}).click();
 await expect(page.getByRole('button',{name:'Zatwierdź wycenę',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Zatwierdź wycenę',exact:true}).click();
 await expect(page.getByRole('heading',{name:'W/001/2026'})).toBeVisible();
 await expect.poll(()=>publishedPdfRequests).toBeGreaterThanOrEqual(2);
 await expect(page.locator('.textLayer')).toHaveCount(0);
 releasePublishedPdf=true;
 await expect(page.getByRole('button',{name:'Pobierz numerowany PDF',exact:true})).toBeEnabled();
 expect(published).toBe(true);expect(methods.filter(m=>m==='GenerateQuoteText')).toHaveLength(1);expect(turn).toBe(2);
 await expect.poll(()=>page.locator('#main-content').evaluate(e=>e.scrollWidth<=e.clientWidth)).toBe(true);
});
