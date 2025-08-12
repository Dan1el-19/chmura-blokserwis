import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { listFiles } from '@/lib/storage';
import { db } from '@/lib/firebaseAdmin';
import { generateUniqueFolderId } from '@/lib/folderIds';

// POST /api/folders/retro-meta  { folder: 'personal'|'main', path?: string }
// Scans current prefix, ensures each immediate child folder has metadata doc.
export async function POST(req: NextRequest) {
  try {
    if (!db) return NextResponse.json({ error: 'Firestore disabled' }, { status: 503 });
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) return NextResponse.json({ error: 'Brak tokenu' }, { status: 401 });
    const token = authHeader.split('Bearer ')[1];
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Token' }, { status: 401 });
    const body = await req.json().catch(()=>({}));
    const folder = body.folder === 'main' ? 'main' : 'personal';
    const pathParam = (body.path || '').replace(/^\/+/,'').replace(/\.\./g,'');
    const basePrefix = folder === 'personal' ? `users/${decoded.uid}/` : 'main/';
    const prefix = basePrefix + (pathParam ? (pathParam.endsWith('/')?pathParam:pathParam+'/') : '');
    const objects = await listFiles(prefix);
    const existingDocs: Record<string, boolean> = {};
    const col = db.collection('folders');
    // Preload docs for current prefix
    const snap = await col.where('path','>=', prefix).where('path','<', prefix + '\uf8ff').get();
    snap.docs.forEach(d=>{ existingDocs[d.data().path] = true; });
    const created: string[] = [];
    for (const obj of objects) {
      const key = obj.Key!;
      if (!key.startsWith(prefix)) continue;
      const rest = key.substring(prefix.length);
      if (rest.endsWith('/.keep')) {
        const folderName = rest.slice(0, -'/.keep'.length);
        if (folderName.includes('/')) continue; // only immediate
        const folderPath = prefix + folderName + '/';
        if (existingDocs[folderPath]) continue;
        const shortId = await generateUniqueFolderId();
        const slug = `${folderName}-${shortId}`;
        await col.add({ name: folderName, shortId, slug, path: folderPath, owner: folder==='personal'?decoded.uid:'main', space: folder, createdAt: new Date(), updatedAt: new Date() });
        created.push(folderPath);
      }
    }
    return NextResponse.json({ created });
  } catch (e) {
    console.error('retro-meta error', e);
    return NextResponse.json({ error: 'Błąd retro meta' }, { status: 500 });
  }
}