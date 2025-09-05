import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeS3Client, getBucketName, listFiles } from '@/lib/storage';
import { db } from '@/lib/firebaseAdmin';

// DELETE /api/files/delete-folder?path=<urlencoded full folder path ending with />
// path must include trailing slash. This will delete ALL objects under that prefix (dangerous!)
export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Brak tokenu autoryzacji' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    let path = searchParams.get('path') || '';
    path = decodeURIComponent(path);
    if (!path.endsWith('/')) return NextResponse.json({ error: 'Ścieżka folderu musi mieć kończący /' }, { status: 400 });
    if (path.includes('..')) return NextResponse.json({ error: 'Nieprawidłowa ścieżka' }, { status: 400 });

    // Ownership checks
    const isPersonal = path.startsWith(`users/${decoded.uid}/`);
    const isMain = path.startsWith('main/');
    if (!isPersonal && !isMain) {
      return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
    }
    if (isMain) {
      const role = (decoded as { role?: string } | undefined)?.role || 'basic';
      if (role !== 'admin' && role !== 'plus') {
        return NextResponse.json({ error: 'Brak uprawnień do folderu głównego' }, { status: 403 });
      }
    }

    // List all objects with this prefix
    const objects = await listFiles(path);
    if (objects.length === 0) {
      return NextResponse.json({ success: true, deleted: 0 });
    }

    const client = initializeS3Client();
    const bucket = getBucketName();
    const { DeleteObjectsCommand } = await import('@aws-sdk/client-s3');

    // Batch delete up to 1000 at a time (R2 supports similar semantics)
    let deletedCount = 0;
    const keys = objects.map(o => o.Key!).filter(Boolean);
    while (keys.length) {
      const batch = keys.splice(0, 1000);
      await client.send(new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: batch.map(Key => ({ Key })) } }));
      deletedCount += batch.length;
    }

    // Firestore: remove folder metadata doc(s)
    if (db) {
      try {
        const snaps = await db.collection('folders').where('path','==', path).get();
        const batch = db.batch();
        snaps.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
      } catch (err) {
        console.error('Folder metadata delete error', err);
      }
    }

    return NextResponse.json({ success: true, deleted: deletedCount });
  } catch (e) {
    console.error('delete-folder error', e);
    return NextResponse.json({ error: 'Błąd usuwania folderu' }, { status: 500 });
  }
}
