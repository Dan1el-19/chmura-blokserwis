import { data as sample, scopes } from './fixtures.mjs';
import { pathToFileURL } from 'node:url';

const title = 'Monitoring budynku administracyjnego i części magazynowej przy ul. Piotrkowskiej 44 w Łodzi';
export const prototypeCases = [
  sample(5), sample(7), sample(8,{long:true,title}),
  sample(5,{scope:Array.from({length:8},(_,i)=>[`${scopes[i%3][0]} - strefa ${i+1}`,scopes[i%3][1]+' '+scopes[(i+1)%3][1]])}),
  sample(5,{large:true}), sample(30), sample(5,{scope:[['Zakres szczegółowy',Array(70).fill(scopes[0][1]).join(' ')]]}), sample(1,{scope:[scopes[0]]}),
  {...sample(5),items:sample(5).items.map((item,i)=>i?item:{...item,name:'KAMERA-'+'ABCDEFGHIJ'.repeat(18)})},
  sample(16,{scope:[]}), sample(15,{scope:[scopes[2]]}), sample(8,{title:title+' - etap pierwszy, strefa wejściowa i zaplecze techniczne'}), sample(40),
  {...sample(1,{scope:[scopes[2]]}),items:[{...sample(1).items[0],desc:Array(30).fill('Dostawa monitora i podłączenie do istniejącego systemu monitoringu.').join(' ')}]},
  sample(2,{scope:Array.from({length:20},(_,i)=>[`${scopes[i%3][0]} - strefa ${i+1}`,scopes[i%3][1]])}), sample(5,{scope:[]}),
];

function limitUtf8(text, max) {
  const bytes = new TextEncoder(); let result = ''; let used = 0;
  for (const character of text) { const size = bytes.encode(character).length; if (used + size > max) break; used += size; result += character; }
  return result;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const fixtures = prototypeCases.map((item, index) => ({...item, name:`fixture-${String(index+1).padStart(2,'0')}`, items:item.items.map(line=>({...line,desc:limitUtf8(line.desc,2000),price:String(line.price),qty:String(line.qty)}))}));
  process.stdout.write(JSON.stringify(fixtures));
}
