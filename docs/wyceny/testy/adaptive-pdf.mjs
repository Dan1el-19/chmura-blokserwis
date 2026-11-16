// Standalone visual prototype: measured pagination, not application integration.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { planPages, chooseLayout } from './pagination.mjs';
import { data, scopes } from './fixtures.mjs';

const output = process.argv[2];
if (!output) throw new Error('Pass an output directory');
await mkdir(output, { recursive: true });
const assets = '/Users/daniel/Projects/UniSourceGO/internal/quotes/assets';
const font = (await readFile(path.join(assets, 'InterVariable.woff2'))).toString('base64');
const logo = (await readFile(path.join(assets, 'BlokserwisLogo.png'))).toString('base64');
const common = (await readFile(new URL('./wzor.css', import.meta.url), 'utf8')).replace('__FONT_BASE64__', font);
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = value => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);
const mm = value => value * 96 / 25.4;
// 250 mm printable body, with a 1 mm rounding reserve.
const capacity = mm(249);
const css = `
  @page{size:A4;margin:0}
  html,body{margin:0;padding:0}
  .sheet{width:210mm;height:297mm;padding:17mm 19mm 30mm;position:relative;break-after:page;display:flow-root}
  .sheet:last-child{break-after:auto}
  .sheet-body,.probe{width:172mm;display:flow-root}
  .intro-block,.sum-wrap{display:flow-root}
  .table-head,.item{grid-template-columns:minmax(0,1fr) 42mm 33mm}
  .item{margin:0;overflow:visible;break-inside:avoid}
  .item b,.item small,h1{overflow-wrap:anywhere}
  .item .qty{white-space:nowrap}
  .scopebox{margin:0}.scope-heading{padding-bottom:4mm}
  .scopeunit p{font-size:8.5pt;color:#596771;line-height:1.45;margin:0}
  .scopeunit b{display:block;font-size:9pt;line-height:1.45;margin-bottom:.8mm}
  .scopeunit{display:flow-root}
  .scope-gap{height:3mm}.section-gap{height:9mm}
  .table-head span:nth-child(2){padding-right:0}
  .compact .title{margin:9mm 0 7mm}.compact .item{padding:1.8mm 0}
  .compact .section-gap{height:6mm}.compact .scope-gap{height:2mm}
  .compact .scope-heading{padding-bottom:3mm}.compact .sumline{padding-top:3mm}
  .dense .item{padding:1mm 0}.dense .title{margin:7mm 0 5mm}
  .dense .header{padding-bottom:4mm}
  .small-title .title h1{font-size:22pt}
  .small-title .pricing h2,.small-title .scopebox h2{font-size:12.5pt}
  .small-title .sumline strong{font-size:20pt}
  .footer{font-family:Arial,sans-serif}
  .footer b{font-weight:700}
`;
const head = `<div class="header"><img class="logo" src="data:image/png;base64,${logo}"><div class="meta"><strong>W/024/2026</strong><span class="muted">21 sierpnia 2026</span></div></div>`;
const band = title => `<h2>${title}</h2>`;
const tableHead = '<div class="table-head"><span>POZYCJA</span><span>ILOŚĆ I CENA BRUTTO</span><span>WARTOŚĆ BRUTTO</span></div>';
const intro = d => `<div class="intro-block">${head}<div class="title"><h1>${esc(d.title)}</h1></div></div>`;
const total = d => `<div class="sum-wrap"><div class="sumline"><span>ŁĄCZNA WARTOŚĆ BRUTTO</span><strong>${esc(money(d.items.reduce((sum, item) => sum + item.qty * item.price, 0)))}</strong></div></div>`;
const scopeHeading = `<div class="scope-heading">${band('Zakres')}</div>`;
const footer = (number, count) => `<div class="footer"><div><b>BLOKSERWIS S.C.</b><br>Michał Łodyga, Radosław Beska<br>NIP 7272869572</div><div><b>${number} / ${count}</b></div><div>+48 731 188 655<br>biuro@blokserwis.pl<br>blokserwis.pl</div></div>`;
function row(unit) {
  const { item, continuation } = unit;
  return `<div class="item"><div>${unit.name ? `<b>${esc(unit.name)}</b>` : ''}${unit.desc ? `<small>${esc(unit.desc)}</small>` : ''}</div><div class="qty">${continuation ? '' : `${esc(new Intl.NumberFormat('pl-PL').format(item.qty))} × ${esc(money(item.price))}`}</div><strong>${continuation ? '' : esc(money(item.qty * item.price))}</strong></div>`;
}
const scope = unit => `<div class="scopeunit">${unit.first ? `<b>${esc(unit.name)}</b>` : ''}<p>${esc(unit.text)}</p></div>`;
const document = (body, mode) => `<!doctype html><html lang="pl"><meta charset="utf-8"><style>${common}${css}</style><body class="${mode}">${body}</body></html>`;
const modes = [
  { id:'normal', className:'', designPenalty:0 },
  { id:'compact', className:'compact', designPenalty:12 },
  { id:'normal-title', className:'small-title', designPenalty:8 },
  { id:'compact-title', className:'compact small-title', designPenalty:20 },
  { id:'dense', className:'compact dense', designPenalty:32 },
  { id:'dense-title', className:'compact dense small-title', designPenalty:40 },
];
const browser = await chromium.launch({ headless:true });
const page = await browser.newPage({ viewport:{width:1000,height:1200} });
await page.emulateMedia({ media:'print' });
async function load(body, mode) {
  await page.setContent(document(body, mode));
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
}

// Read actual browser line breaks; never estimate characters-per-line.
async function linesFor(text, selector, mode) {
  await load(`<div class="probe">${selector === 'scope' ? `<div class="scopeunit"><p id="split">${esc(text)}</p></div>` : `<div class="item"><div>${selector === 'name' ? `<b id="split">${esc(text)}</b>` : `<small id="split">${esc(text)}</small>`}</div><div></div><strong></strong></div>`}</div>`, mode);
  return page.evaluate(() => {
    const element = document.querySelector('#split');
    const node = element.firstChild;
    if (!node) return [];
    const matches = [...node.textContent.matchAll(/\S+\s*/gu)];
    const lines = [];
    for (const match of matches) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].trimEnd().length);
      const rect = range.getBoundingClientRect();
      const last = lines.at(-1);
      if (last && Math.abs(last.top - rect.top) < 1) last.text += match[0];
      else lines.push({ top:rect.top, text:match[0] });
    }
    return lines.map(line => line.text);
  });
}
function chunks(lines, limit) {
  const result = [];
  for (let i = 0; i < lines.length; i += limit) result.push(lines.slice(i, i + limit).join(''));
  // No one- or two-line remainder from an oversized paragraph.
  if (lines.length % limit > 0 && lines.length % limit < 3 && result.length > 1) result[result.length - 2] += result.pop();
  return result;
}

async function buildCandidate(d, mode) {
  const units = [];
  for (const [index, item] of d.items.entries()) units.push({ kind:'row', index, item, name:item.name, desc:item.desc, continuation:false });
  // First measure complete rows. Only truly oversized rows are fragmented.
  await load(`<div class="probe">${units.map(unit => row(unit)).join('')}</div>`, mode.className);
  const rowHeights = await page.locator('.item').evaluateAll(elements => elements.map(e => e.getBoundingClientRect().height));
  const rows = [];
  for (const [i, unit] of units.entries()) {
    if (rowHeights[i] < capacity * .6) { rows.push(unit); continue; }
    const nameParts = chunks(await linesFor(unit.name, 'name', mode.className), 10);
    const descParts = chunks(await linesFor(unit.desc, 'desc', mode.className), 10);
    rows.push(...nameParts.map((name, part) => ({ ...unit, name, desc:'', continuation:part > 0 })));
    if (descParts.length) {
      rows.at(-1).desc = descParts.shift();
      rows.push(...descParts.map(desc => ({ ...unit, name:'', desc, continuation:true })));
    }
  }
  units.splice(0, units.length, ...rows);
  for (const [index, [name, text]] of d.scopes.entries()) {
    const lines = await linesFor(text, 'scope', mode.className);
    const parts = lines.length <= 12 ? [text] : chunks(lines, 6);
    for (const [part, text] of parts.entries()) units.push({ kind:'scope', index, name, text, first:part === 0 });
  }
  if (!units.length) throw new Error('Empty quotation has no content');
  const rowCount = rows.length;
  await load(`<div class="probe">${intro(d)}<section class="pricing"><div id="price-heading">${band('Wycena')}</div>${tableHead}${rows.map(row).join('')}${total(d)}</section><section class="scopebox">${scopeHeading}${units.filter(u => u.kind === 'scope').map(scope).join('')}</section></div>`, mode.className);
  const metrics = await page.evaluate(() => {
    const height = selector => document.querySelector(selector).getBoundingClientRect().height;
    return { intro:height('.intro-block'), priceHeading:height('#price-heading'), tableHead:height('.table-head'), sum:height('.sum-wrap'), scopeHeading:height('.scope-heading'),
      rows:[...document.querySelectorAll('.item')].map(e=>e.getBoundingClientRect().height),
      scopes:[...document.querySelectorAll('.scopeunit')].map(e=>e.getBoundingClientRect().height) };
  });
  const compact = mode.className.includes('compact');
  const sectionGap = mm(compact ? 6 : 9);
  const scopeGap = mm(compact ? 2 : 3);
  const heights = [...metrics.rows, ...metrics.scopes];
  const prefix = [0];
  for (let i = 0; i < units.length; i++) prefix.push(prefix.at(-1) + heights[i] + (i > rowCount && units[i].index !== units[i-1].index ? scopeGap : 0));
  const measure = (start, end) => {
    let height = prefix[end] - prefix[start];
    if (start === 0) height += metrics.intro;
    const hasRows = start < rowCount;
    const hasScope = end > rowCount;
    if (hasRows) height += metrics.tableHead + (start === 0 ? metrics.priceHeading : 0);
    if (hasRows && end >= rowCount) height += metrics.sum;
    if (hasScope) {
      height += metrics.scopeHeading + (hasRows ? sectionGap : 0);
      if (start > rowCount && units[start].index !== units[start-1].index) height -= scopeGap;
    }
    return height;
  };
  const breakPenalty = end => {
    const prev = units[end-1], next = units[end];
    if (prev.kind === next.kind && prev.index === next.index) return 10;
    // Prefer a clean transition between pricing and scope when possible.
    return prev.kind !== next.kind ? 0 : 1;
  };
  const plan = planPages({ count:units.length, capacity, measure, breakPenalty });
  const greedyPages = [];
  for (let start = 0; start < units.length;) {
    let end = start + 1;
    while (end < units.length && measure(start,end+1) <= capacity) end++;
    greedyPages.push({start,end,height:measure(start,end)});
    start = end;
  }
  return { ...mode, ...plan, units, rowCount, metrics, capacity, greedyPages };
}
function bodyForRange(d, candidate, {start,end}) {
  const { units, rowCount } = candidate;
  const segment = units.slice(start, end);
  const rows = segment.filter(u => u.kind === 'row');
  const scopeUnits = segment.filter(u => u.kind === 'scope');
  let result = start === 0 ? intro(d) : '';
  if (rows.length) result += `<section class="pricing">${start === 0 ? band('Wycena') : ''}${tableHead}${rows.map(row).join('')}${end >= rowCount ? total(d) : ''}</section>`;
  if (scopeUnits.length) result += `${rows.length ? '<div class="section-gap"></div>' : ''}<section class="scopebox">${scopeHeading}${scopeUnits.map((unit, i) => `${i && unit.index !== scopeUnits[i-1].index ? '<div class="scope-gap"></div>' : ''}${scope(unit)}`).join('')}</section>`;
  return result;
}
async function render(d, candidate) {
  await load(candidate.pages.map((range,i) => `<main class="sheet"><div class="sheet-body">${bodyForRange(d,candidate,range)}</div>${footer(i+1,candidate.pages.length)}</main>`).join(''), candidate.className);
  const geometry = await page.evaluate(() => [...document.querySelectorAll('.sheet')].map(sheet => {
    const body = sheet.querySelector('.sheet-body').getBoundingClientRect();
    const footer = sheet.querySelector('.footer').getBoundingClientRect();
    const overflow = [...sheet.querySelectorAll('.item,.item>.qty,.item>strong,.table-head>span,h1,.sumline,.scopeunit')].filter(e=>e.scrollWidth>e.clientWidth+1).map(e=>e.textContent);
    const points = selector => {
      const element = sheet.querySelector(selector);
      return element ? parseFloat(getComputedStyle(element).fontSize) * .75 : null;
    };
    return { height:body.height, footerGap:footer.top-body.bottom, overflow,
      typography:{title:points('h1'),section:points('h2'),item:points('.item'),description:points('.item small'),scope:points('.scopeunit p'),sum:points('.sumline strong')} };
  }));
  for (const [i, geometryPage] of geometry.entries()) {
    if (geometryPage.height > capacity + 1 || geometryPage.footerGap < 0 || geometryPage.overflow.length) throw new Error(`Invalid geometry on page ${i+1}: ${JSON.stringify(geometryPage)}`);
    if (Math.abs(geometryPage.height-candidate.pages[i].height)>2) throw new Error(`Measurement drift on page ${i+1}: ${geometryPage.height} vs ${candidate.pages[i].height}`);
  }
  return { geometry, buffer:await page.pdf({printBackground:true,preferCSSPageSize:true,tagged:true}) };
}

const longTitle = 'Monitoring budynku administracyjnego i części magazynowej przy ul. Piotrkowskiej 44 w Łodzi';
const cases = [
  ['01-odniesienie', data(5)],
  ['02-granica-strony', data(7)],
  ['03-dlugie-nazwy', data(8,{long:true,title:longTitle})],
  ['04-rozbudowany-zakres', data(5,{scope:Array.from({length:8},(_,i)=>[`${scopes[i%3][0]} - strefa ${i+1}`,scopes[i%3][1]+' '+scopes[(i+1)%3][1]])})],
  ['05-duze-kwoty', data(5,{large:true})],
  ['06-trzydziesci-pozycji', data(30)],
  ['07-dlugi-akapit', data(5,{scope:[['Zakres szczegółowy',Array(70).fill(scopes[0][1]).join(' ')] ]})],
  ['08-jedna-pozycja', data(1,{scope:[scopes[0]]})],
  ['10-dlugi-identyfikator',{...data(5),items:data(5).items.map((item,i)=>i?item:{...item,name:'KAMERA-'+'ABCDEFGHIJ'.repeat(18)})}],
  ['11-sama-suma', data(16,{scope:[]})],
  ['12-kilka-wierszy-zakresu', data(15,{scope:[scopes[2]]})],
  ['13-dlugi-tytul', data(8,{title:longTitle+' - etap pierwszy, strefa wejściowa i zaplecze techniczne'})],
  ['14-czterdziesci-pozycji', data(40)],
  ['15-jeden-ogromny-wiersz',{...data(1,{scope:[scopes[2]]}),items:[{...data(1).items[0],desc:Array(65).fill('Dostawa monitora i podłączenie do istniejącego systemu monitoringu.').join(' ')}]}],
  ['16-duzo-zakresu',data(2,{scope:Array.from({length:20},(_,i)=>[`${scopes[i%3][0]} - strefa ${i+1}`,scopes[i%3][1]])})],
  ['17-bez-zakresu',data(5,{scope:[]})],
];
const results = [];
const fixtures = {};
try {
  for (const [name,d] of cases) {
    const candidates = [];
    const rejected = [];
    for (const mode of modes) {
      try { candidates.push(await buildCandidate(d,mode)); }
      catch (error) {
        if (!error.message.startsWith('Content cannot fit a page')) throw error;
        rejected.push({mode:mode.id,reason:error.message});
      }
    }
    const chosen = chooseLayout(candidates);
    const rendered = await render(d,chosen);
    const actualPages = (rendered.buffer.toString('latin1').match(/\/Type\s*\/Page\b/g)??[]).length;
    if (actualPages !== chosen.pages.length) throw new Error(`Unexpected extra printed page in ${name}`);
    await writeFile(path.join(output,`${name}.pdf`),rendered.buffer);
    await writeFile(path.join(output,`${name}.html`),await page.content());
    // Verify the full source is preserved before testing the extracted PDF.
    const normalize = s => s.replace(/\s+/gu,'');
    for (const [i,item] of d.items.entries()) for (const field of ['name','desc']) {
      if (normalize(chosen.units.filter(u=>u.kind==='row'&&u.index===i).map(u=>u[field]).join('')) !== normalize(item[field])) throw new Error(`Row source changed: ${name}`);
    }
    for (const [i,[,text]] of d.scopes.entries()) if (normalize(chosen.units.filter(u=>u.kind==='scope'&&u.index===i).map(u=>u.text).join('')) !== normalize(text)) throw new Error(`Scope source changed: ${name}`);
    fixtures[name] = { ...d, expectedSegments:[d.title,...chosen.units.flatMap(u=>u.kind==='row'?[u.name,u.desc]:[u.first?u.name:'',u.text])].filter(Boolean) };
    const summarize = c => ({ id:c.id, pages:c.pages.length, fill:c.pages.map(p=>+(p.height/capacity).toFixed(3)),score:+c.score.toFixed(2),designPenalty:c.designPenalty });
    const greedyCandidate = candidates.reduce((best,candidate)=>candidate.greedyPages.length < best.greedyPages.length ||
      (candidate.greedyPages.length === best.greedyPages.length && candidate.designPenalty < best.designPenalty) ? candidate : best);
    const greedy = {...greedyCandidate,pages:greedyCandidate.greedyPages};
    if (['07-dlugi-akapit','11-sama-suma','12-kilka-wierszy-zakresu','13-dlugi-tytul'].includes(name)) {
      const before = await render(d,greedy);
      await writeFile(path.join(output,`${name}-przed.pdf`),before.buffer);
    }
    const result = {name,items:d.items.length,mode:chosen.id,pages:actualPages,fill:chosen.pages.map(p=>+(p.height/capacity).toFixed(3)),geometry:rendered.geometry,candidates:candidates.map(summarize),
      greedy:{mode:greedy.id,pages:greedy.pages.length,fill:greedy.pages.map(p=>+(p.height/capacity).toFixed(3))},rejected};
    results.push(result);
    console.log(`${name}: ${chosen.id}, ${actualPages} pages, fill ${result.fill.join(' / ')}`);
  }
  let emptyRejected = false;
  try { await buildCandidate(data(0,{scope:[]}),modes[0]); }
  catch (error) { if (error.message === 'Empty quotation has no content') emptyRejected = true; else throw error; }
  if (!emptyRejected) throw new Error('Empty quotation was accepted');
  await writeFile(path.join(output,'validation.json'),JSON.stringify({emptyRejected},null,2));
  await writeFile(path.join(output,'fixtures.json'),JSON.stringify(fixtures,null,2));
  await writeFile(path.join(output,'geometry.json'),JSON.stringify(results,null,2));
} finally { await browser.close(); }
