import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { prototypeCases } from './fixture-cases.mjs';

const backend = process.env.QUOTES_BACKEND || resolve(process.cwd(), '../UniSourceGO');
const assets = `${backend}/internal/quotes/assets`;
const [css, script, regular, bold, logo] = await Promise.all(['document-v4.css', 'layout-v4.js', 'Inter-Regular.woff2', 'Inter-Bold.woff2', 'BlokserwisLogo.png'].map(file => readFile(`${assets}/${file}`)));
const b64 = bytes => bytes.toString('base64');
let browser;
before(async () => { browser = await chromium.launch({headless: true}); });
after(async () => { await browser?.close(); });

function fixture(count, {long = false, scope = false} = {}) {
  return { title:'Monitoring budynku', client:'Klient sp. z o.o.', date:'2026-11-16', number:'WYC/2026/0001', logo:`data:image/png;base64,${b64(logo)}`, total:'123.00', issuer:{name:'Firma',partners:'Wspólnicy',taxId:'1234567890',phone:'123456789',email:'biuro@example.pl',website:'example.pl'},
    lines:Array.from({length:count}, (_, i) => ({name:`Pozycja ${i + 1}${long && i === 0 ? ' ' + 'A'.repeat(800) : ''}`, description:'Opis pozycji', quantity:'1',price:'1.00',amount:'1.00'})),
    sections:scope ? [{heading:'Zakres', body:'Montaż kamery i uruchomienie. '.repeat(150)}] : [] };
}
async function render(data) {
  const page = await browser.newPage(); page.on('console', m => { if (m.type() === 'error') console.error(m.text()); });
  await page.emulateMedia({media:'print'});
  const fonts = `@font-face{font-family:Inter;src:url(data:font/woff2;base64,${b64(regular)});font-weight:400}@font-face{font-family:Inter;src:url(data:font/woff2;base64,${b64(bold)});font-weight:700}`;
  const payload = JSON.stringify(data).replaceAll('<', '\\u003c');
  await page.setContent(`<!doctype html><html lang="pl"><head><meta charset="utf-8"><style>${fonts}${css}</style></head><body><script id="quote-data" type="application/json">${payload}</script><script>${script}</script></body></html>`);
  await page.waitForFunction(() => window.__quoteLayout?.status !== 'loading', {timeout: 40000});
  return page;
}
for (const [name, data] of [['one page', fixture(5)], ['long document', fixture(40,{scope:true})], ['unbroken identifier', fixture(2,{long:true})], ['500 lines', fixture(500)]]) {
  test(name, {timeout: 50000}, async () => {
    const page = await render(data);
    try {
      const result = await page.evaluate(() => ({layout:window.__quoteLayout, text:document.body.innerText, sheets:document.querySelectorAll('.sheet').length}));
      assert.equal(result.layout.status, 'ready', JSON.stringify(result.layout));
      assert.equal(result.sheets, result.layout.pageCount);
      assert.ok(result.text.includes(data.lines.at(-1).name));
      assert.ok(result.text.includes(data.total.replace('.', ',')));
      if (data.sections.length) assert.ok(result.text.includes('uruchomienie'));
    } finally { await page.close(); }
  });
}

test('PDF retains Polish text and long sections', {timeout: 50000}, async () => {
  const data = fixture(3);
  data.lines[0].name = 'Zażółć gęślą jaźń ʼ ’ ˮ ”';
  data.sections = [{heading:'Ustalenia', body:'Prowadzenie przewodu w istniejącym korycie. '.repeat(180)}];
  const page = await render(data);
  try {
    const result = await page.evaluate(() => window.__quoteLayout);
    assert.equal(result.status, 'ready', JSON.stringify(result));
    const bytes = await page.pdf({printBackground:true, preferCSSPageSize:true});
    const {execFileSync} = await import('node:child_process');
    const python = process.env.QUOTES_TEST_PYTHON || 'python3';
    const text = execFileSync(python, ['-c', 'import sys,io; from pypdf import PdfReader; p=PdfReader(io.BytesIO(sys.stdin.buffer.read())); print("\\n".join(x.extract_text() for x in p.pages))'], {input:bytes, encoding:'utf8'});
    assert.ok(text.includes(data.lines[0].name), text.slice(0, 1000));
    assert.ok(text.includes('2026-11-16'), 'date must extract with real hyphens');
    assert.ok(text.includes('×'), 'multiplication sign must extract correctly');
    const compact = s => s.replace(/\s+/gu, '');
    const needle = compact('Prowadzenie przewodu w istniejącym korycie.'); const actual = compact(text).split(needle).length - 1; assert.equal(actual, 180, `sentence count ${actual}; text: ${text.slice(-1200)}`);
  } finally { await page.close(); }
});

test('untrusted document text cannot run script', async () => {
  const data = fixture(1); data.title = '</script><script>window.injected=1</script>';
  const page = await render(data);
  try { assert.equal(await page.evaluate(() => window.injected), undefined); assert.ok((await page.locator('h1').innerText()).includes('</script>')); }
  finally { await page.close(); }
});

test('maximum input preserves content and completes within 40 seconds', {timeout: 50000}, async () => {
  const data = fixture(500);
  data.lines[0].description = 'Ż'.repeat(2000);
  data.sections = [{heading:'Zakres', body:'ą'.repeat(11000)}, {heading:'Inne', body:'ć'.repeat(10900)}];
  const start = performance.now();
  const page = await render(data);
  try {
    const result = await page.evaluate(() => ({layout:window.__quoteLayout, description:[...document.querySelectorAll('.sheet .item[data-index="0"] small')].map(e => e.textContent).join(''), scope:[0,1].map(i => [...document.querySelectorAll(`.sheet .scopeunit[data-index="${i}"] p`)].map(e => e.textContent).join(''))}));
    assert.equal(result.layout.status, 'ready', JSON.stringify(result.layout));
    assert.equal(result.description, data.lines[0].description); for (let i=0; i<2; i++) assert.equal(result.scope[i], data.sections[i].body);
    assert.ok(performance.now() - start < 40000);
  } finally { await page.close(); }
});

test('16 prototype documents compose with complete content', {timeout:60000}, async () => {
  for (const [index, original] of prototypeCases.entries()) {
    const data = fixture(0); data.title = original.title;
    data.lines = original.items.map(item => ({name:item.name, description:item.desc, quantity:String(item.qty), price:item.price.toFixed(2), amount:(item.qty*item.price).toFixed(2)}));
    data.sections = original.scopes.map(([heading,body]) => ({heading,body}));
    const page = await render(data);
    try {
      const result = await page.evaluate(() => ({layout:window.__quoteLayout, lines:[...document.querySelectorAll('.sheet .item')].map(n => ({index:Number(n.dataset.index), name:n.querySelector('b')?.textContent || '', description:n.querySelector('small')?.textContent || ''})), scopes:[...document.querySelectorAll('.sheet .scopeunit')].map(n => ({index:Number(n.dataset.index), body:n.querySelector('p')?.textContent || ''}))}));
      assert.equal(result.layout.status, 'ready', `fixture ${index+1}: ${JSON.stringify(result.layout)}`);
      for (const [i,item] of data.lines.entries()) {
        assert.equal(result.lines.filter(line=>line.index===i).map(line=>line.name).join(''), item.name, `fixture ${index+1}, name ${i}`);
        assert.equal(result.lines.filter(line=>line.index===i).map(line=>line.description).join(''), item.description, `fixture ${index+1}, description ${i}`);
      }
      for (const [i,scope] of data.sections.entries()) assert.equal(result.scopes.filter(s=>s.index===i).map(s=>s.body).join(''), scope.body, `fixture ${index+1}, scope ${i}`);
    } finally { await page.close(); }
  }
});

test('formats decimal amounts in Polish without losing digits', async () => {
 const data=fixture(1); data.lines[0].price='1234.5678'; data.lines[0].amount='1234.57'; data.total='1234.57';
 const page=await render(data);
 try {
  const result=await page.evaluate(() => ({layout:window.__quoteLayout, text:document.querySelector('.sheet-body')?.textContent || ''}));
  assert.equal(result.layout.status,'ready');
  assert.match(result.text,/1[\s\u00a0]234,5678 zł/u);
  assert.match(result.text,/1[\s\u00a0]234,57 zł/u);
 } finally { await page.close(); }
});

test('long client identifiers wrap without clipping', async () => {
 const data=fixture(1); data.client='K'.repeat(2000);
 const page=await render(data);
 try {
  const result=await page.evaluate(() => ({layout:window.__quoteLayout, client:document.querySelector('.title p')?.textContent, overflow:[...document.querySelectorAll('.title p')].some(n=>n.scrollWidth>n.clientWidth+1)}));
  assert.equal(result.layout.status,'ready'); assert.equal(result.client,data.client); assert.equal(result.overflow,false);
 } finally { await page.close(); }
});
