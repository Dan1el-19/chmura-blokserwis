// Visual prototype QA. Does not change the application or backend renderer.
import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { data, scopes } from './fixtures.mjs';

const output = process.argv[2];
if (!output) throw new Error('Pass an output directory.');
await mkdir(output, { recursive: true });
const assets = '/Users/daniel/Projects/UniSourceGO/internal/quotes/assets';
const font = (await readFile(path.join(assets, 'InterVariable.woff2'))).toString('base64');
const logo = (await readFile(path.join(assets, 'BlokserwisLogo.png'))).toString('base64');
const common = (await readFile(new URL('./wzor.css', import.meta.url), 'utf8')).replace('__FONT_BASE64__', font);
const head = `<div class="header"><img class="logo" src="data:image/png;base64,${logo}"><div class="meta"><strong>W/024/2026</strong><span class="muted">21 sierpnia 2026</span></div></div>`;
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const money = value => new Intl.NumberFormat('pl-PL', { style: 'currency', currency: 'PLN' }).format(value);
const footer = `<style>@font-face{font-family:Inter;src:url(data:font/woff2;base64,${font})}</style><div style="position:relative;width:100%;margin:0 19mm;padding-top:3mm;border-top:1px solid #dfe3e6;font-family:Arial,sans-serif;font-size:9.86px;line-height:1.65;color:#697681;display:flex;justify-content:space-between"><div><b>BLOKSERWIS S.C.</b><br>Michał Łodyga, Radosław Beska<br>NIP 7272869572</div><div style="position:absolute;left:50%;transform:translateX(-50%);top:3mm"><b><span class="pageNumber"></span> / <span class="totalPages"></span></b></div><div style="text-align:right">+48 731 188 655<br>biuro@blokserwis.pl<br>blokserwis.pl</div></div>`;
const printStyle = `
  @page{size:A4;margin:17mm 19mm 30mm}
  .page{width:172mm;min-height:0;padding:0;position:static}
  .title h1{overflow-wrap:anywhere}
  table.prices{table-layout:fixed;font-size:9pt}
  .prices col:nth-child(2){width:45mm}.prices col:nth-child(3){width:35mm}
  .prices th,.prices td{padding:2.5mm 0;vertical-align:middle}
  .prices td:first-child{width:auto;overflow-wrap:anywhere;padding-right:3mm}
  .prices th{font-size:6.5pt;padding:4mm 0 2mm}
  .prices th:not(:first-child),.prices td:not(:first-child){text-align:right}
  .prices td:nth-child(2){font-size:8pt;color:#62707a;padding-right:3mm}
  .prices small{display:block;font-size:7.5pt;color:#7b8790;margin-top:.8mm}
  .prices tr{break-inside:avoid}.prices thead{display:table-header-group}
  h2{break-after:avoid}.scopegrid>div{break-inside:avoid}.scopegrid>div.oversize{break-inside:auto;orphans:3;widows:3}
  .sumline{break-inside:avoid;break-before:avoid}.header,.title{break-inside:avoid}
  .pricing h2{break-after:avoid}.scopebox{break-inside:auto}
  .compact .title{margin:9mm 0 7mm}.compact .prices td{padding:1.8mm 0}
  .compact .scopebox{margin-top:6mm}.compact .scopegrid{gap:2mm;padding-top:3mm}
  .compact .sumline{padding-top:3mm}
  .dense .prices td{padding:1mm 0}
  .dense .title{margin:7mm 0 5mm}.dense .header{padding-bottom:4mm}
`;
function html(d, compact) {
  return `<!doctype html><html lang="pl"><meta charset="utf-8"><style>${common}${printStyle}</style><body class="${compact ? 'compact' : ''}"><main class="page">${head}<div class="title"><h1>${esc(d.title)}</h1></div><section class="pricing"><h2>Wycena</h2><table class="prices"><colgroup><col><col></colgroup><thead><tr><th>POZYCJA</th><th>ILOŚĆ I CENA BRUTTO</th><th>WARTOŚĆ BRUTTO</th></tr></thead><tbody>${d.items.map(item => `<tr><td><b>${esc(item.name)}</b><small>${esc(item.desc)}</small></td><td>${esc(new Intl.NumberFormat('pl-PL').format(item.qty))} × ${esc(money(item.price))}</td><td><b>${esc(money(item.qty * item.price))}</b></td></tr>`).join('')}</tbody></table><div class="sumline"><span>ŁĄCZNA WARTOŚĆ BRUTTO</span><strong>${esc(money(d.items.reduce((sum, item) => sum + item.qty * item.price, 0)))}</strong></div></section><section class="scopebox"><h2>Zakres</h2><div class="scopegrid">${d.scopes.map(([name, text]) => `<div class="${text.length > 1600 ? 'oversize' : ''}"><b>${esc(name)}</b><p>${esc(text)}</p></div>`).join('')}</div></section></main></body></html>`;
}
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.emulateMedia({ media: 'print' });
async function measure(d, mode) {
  await page.setContent(html(d, mode !== 'normal'));
  if (mode === 'dense') await page.evaluate(() => document.body.classList.add('dense'));
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode()));
  });
  return page.evaluate(() => {
    const main = document.querySelector('main').getBoundingClientRect();
    const overflow = [...document.querySelectorAll('td,h1,strong')].filter(e => e.scrollWidth > e.clientWidth + 1).map(e => e.textContent);
    return { height: main.height, overflow };
  });
}
const capacity = 250 * 96 / 25.4;
let boundary;
for (let n = 6; n <= 20; n++) {
  const d = data(n);
  const normal = await measure(d, 'normal');
  const compact = await measure(d, 'compact');
  if (normal.height > capacity && compact.height <= capacity) { boundary = n; break; }
}
if (!boundary) throw new Error('No single-page boundary found.');
const cases = [
  ['01-odniesienie', data(5)],
  ['02-granica-strony', data(boundary)],
  ['03-dlugie-nazwy', data(8, { long: true, title: 'Monitoring budynku administracyjnego i części magazynowej przy ul. Piotrkowskiej 44 w Łodzi' })],
  ['04-rozbudowany-zakres', data(5, { scope: Array.from({ length: 8 }, (_, i) => [`${scopes[i % 3][0]} - strefa ${i + 1}`, scopes[i % 3][1] + ' ' + scopes[(i + 1) % 3][1]]) })],
  ['05-duze-kwoty', data(5, { large: true })],
  ['06-trzydziesci-pozycji', data(30)],
  ['07-dlugi-akapit', data(5, { scope: [['Zakres szczegółowy', Array.from({ length: 70 }, () => scopes[0][1]).join(' ')]] })],
  ['08-jedna-pozycja', data(1, { scope: [scopes[0]] })],
  ['09-bez-pozycji', data(0, { scope: [] })],
  ['10-dlugi-identyfikator', { ...data(5), items: data(5).items.map((item, i) => i ? item : { ...item, name: 'KAMERA-' + 'ABCDEFGHIJ'.repeat(18) }) }],
];
const results = [];
const pdfOptions = { printBackground: true, preferCSSPageSize: true, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: footer, margin: { top: '17mm', bottom: '30mm', left: '19mm', right: '19mm' } };
const countPages = buffer => (buffer.toString('latin1').match(/\/Type\s*\/Page\b/g) ?? []).length;
for (const [name, d] of cases) {
  const candidates = [];
  for (const mode of ['normal', 'compact', 'dense']) {
    const measured = await measure(d, mode);
    const buffer = await page.pdf(pdfOptions);
    const pages = countPages(buffer);
    if (!pages) throw new Error('Cannot count PDF pages.');
    candidates.push({ mode, measured, buffer, pages });
  }
  const chosen = candidates.reduce((best, candidate) => candidate.pages < best.pages ? candidate : best);
  await measure(d, chosen.mode);
  await writeFile(path.join(output, `${name}.pdf`), chosen.buffer);
  await writeFile(path.join(output, `${name}.html`), await page.content());
  results.push({ name, items: d.items.length, scopeBlocks: d.scopes.length, mode: chosen.mode, pages: chosen.pages, candidates: candidates.map(({ mode, measured, pages }) => ({ mode, height: measured.height, pages })), capacity, overflow: chosen.measured.overflow });
  if (name === '02-granica-strony') {
    await writeFile(path.join(output, '02-granica-bez-korekty.pdf'), candidates[0].buffer);
  }
}
await writeFile(path.join(output, 'geometry.json'), JSON.stringify(results, null, 2));
await writeFile(path.join(output, 'fixtures.json'), JSON.stringify(Object.fromEntries(cases), null, 2));
await browser.close();
console.log(JSON.stringify(results, null, 2));
