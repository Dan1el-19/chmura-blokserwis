from pathlib import Path
import json, subprocess
import sys, logging, re
from collections import Counter
import pdfplumber
from PIL import Image, ImageOps, ImageDraw
logging.getLogger('pdfminer').setLevel(logging.ERROR)
root=Path(sys.argv[1])
fixtures=json.loads((root/'fixtures.json').read_text())
normalize=lambda s: re.sub(r'\s+', '', s.translate(str.maketrans({'ˮ':'”','\ue088':'-','\ue09f':'×'})))
results=[]
thumbs=[]
for file in sorted(root.glob('*.pdf')):
    if file.name in ('pakiet-testowy.pdf','porownanie-podzialu.pdf'): continue
    for old in root.glob(file.stem+'-*.png'):
        if re.fullmatch(re.escape(file.stem)+r'-\d+\.png',old.name): old.unlink()
    subprocess.run(['pdftoppm','-scale-to','1000','-png',str(file),str(root/file.stem)],capture_output=True,check=True)
    with pdfplumber.open(file) as pdf:
        pages=[]
        body_text=[]
        item_text=[]
        for n,p in enumerate(pdf.pages,1):
            words=p.extract_words()
            body=[w for w in words if w['top']<755]
            body_text.append(' '.join(w['text'] for w in body))
            # Separate the item column from vertically centered quantity text.
            item_text.append(p.filter(lambda obj: obj.get('object_type') == 'char' and obj.get('top',999)<755 and obj.get('x0',999)<340 and any(abs(obj.get('size',0)-size)<.1 for size in (9,7.5))).extract_text() or '')
            outside=[w['text'] for w in words if w['x0']<52 or w['x1']>543 or w['bottom']>827]
            counter=[w for w in words if w['top']>770 and w['text'] in [str(n),'/',str(len(pdf.pages))]]
            center=(min(w['x0'] for w in counter)+max(w['x1'] for w in counter))/2 if counter else 0
            pages.append({'page':n,'bodyWords':len(body),'bodyBottom':max((w['bottom'] for w in body),default=0),'outsideMargins':outside,'hasFooter': 'BLOKSERWIS' in p.extract_text(),'pageCounter':f'{n} / {len(pdf.pages)}' in p.extract_text(),'counterCenterErrorPt':round(abs(center-p.width/2),3)})
            im=Image.open(root/f'{file.stem}-{n}.png').convert('RGB')
            im.thumbnail((300,425))
            tile=Image.new('RGB',(330,460),'#ddd')
            tile.paste(im,((330-im.width)//2,20))
            ImageDraw.Draw(tile).text((8,440),f'{file.stem} | {n}/{len(pdf.pages)}',fill='black')
            thumbs.append(tile)
        missing=[]
        if file.stem in fixtures:
            d=fixtures[file.stem]
            actual=normalize(' '.join(body_text))
            item_actual=normalize(' '.join(item_text))
            if 'expectedSegments' in d:
                # Explicitly paginated paragraphs are verified fragment by fragment.
                expected=Counter(normalize(text) for text in d['expectedSegments'])
                missing=[text[:90] for text,count in expected.items() if max(actual.count(text),item_actual.count(text))<count]
            else:
                expected=Counter([normalize(d['title'])]+[normalize(text) for block in d['scopes'] for text in block])
                missing=[text[:90] for text,count in expected.items() if actual.count(text)<count]
                expected_items=Counter(normalize(i[k]) for i in d['items'] for k in ['name','desc'])
                missing += [text[:90] for text,count in expected_items.items() if item_actual.count(text)<count]
        results.append({'name':file.stem,'pages':len(pdf.pages),'details':pages,'missingText':missing})
cols=4
rows=(len(thumbs)+cols-1)//cols
sheet=Image.new('RGB',(cols*330,rows*460),'#bbb')
for i,im in enumerate(thumbs):sheet.paste(im,((i%cols)*330,(i//cols)*460))
sheet.save(root/'przeglad.png')
(root/'audit.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))
failures=[r['name'] for r in results if r['missingText'] or any(p['outsideMargins'] or not p['hasFooter'] or not p['pageCounter'] or p['counterCenterErrorPt']>1 for p in r['details'])]
geometry=json.loads((root/'geometry.json').read_text())
failures += [r['name'] for r in geometry if r.get('fill') and r['pages']>1 and r['fill'][-1]<.4]
for r in geometry:
    for page in r.get('geometry',[]):
        sizes=page.get('typography',{})
        if any(sizes.get(key) is not None and sizes[key]<minimum-.01 for key,minimum in [('title',22),('section',12.5),('item',9),('description',7.5),('scope',8.5),('sum',20)]):
            failures.append(r['name']+' font too small')
if failures: raise SystemExit('Failed PDF audit: '+', '.join(failures))
