import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeS3Client, getBucketName } from '@/lib/storage';

// POST body: { key: string; newName: string }
// Only supports renaming a single file (not folders) in current MVP.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Brak tokenu autoryzacji' }, { status: 401 });
    }
    const token = authHeader.split('Bearer ')[1];
    const decoded = await verifyToken(token);
    if (!decoded) {
      return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
    }
    const body = await request.json().catch(()=>null) as { key?: string; newName?: string } | null;
    if (!body?.key || !body?.newName) {
      return NextResponse.json({ error: 'Brak parametrów' }, { status: 400 });
    }
    const newName = body.newName.trim();
    if (!/^[^/]{1,256}$/.test(newName)) {
      return NextResponse.json({ error: 'Nieprawidłowa nazwa' }, { status: 400 });
    }
    const key = body.key;
    // Prevent renaming .keep markers
    if (key.endsWith('/.keep')) {
      return NextResponse.json({ error: 'Nie można zmienić nazwy folderu (MVP)' }, { status: 400 });
    }
    // Ownership check: personal vs main
    const isPersonal = key.startsWith(`users/${decoded.uid}/`);
    const isMain = key.startsWith('main/');
    if (!isPersonal && !isMain) {
      return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
    }
    if (isMain) {
      const role = (decoded as { role?: string } | undefined)?.role || 'basic';
      if (role !== 'admin' && role !== 'plus') {
        return NextResponse.json({ error: 'Brak uprawnień do plików głównych' }, { status: 403 });
      }
    }
    // Derive new key within same directory
    const lastSlash = key.lastIndexOf('/');
    if (lastSlash === -1) {
      return NextResponse.json({ error: 'Nieprawidłowy klucz' }, { status: 400 });
    }
    const newKey = key.substring(0, lastSlash + 1) + newName;
    if (newKey === key) {
      return NextResponse.json({ success: true, key });
    }
    const client = initializeS3Client();
    const bucket = getBucketName();
    const { CopyObjectCommand, DeleteObjectCommand, HeadObjectCommand } = await import('@aws-sdk/client-s3');
    // Ensure source exists
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    // Copy source to new key
    await client.send(new CopyObjectCommand({ Bucket: bucket, Key: newKey, CopySource: `${bucket}/${key}` }));
    // Delete old object
    await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    return NextResponse.json({ success: true, key: newKey });
  } catch (e: unknown) {
    console.error('rename error', e);
    const httpStatus = typeof e === 'object' && e !== null && '$metadata' in e && typeof (e as Record<string,unknown>).$metadata === 'object'
      ? ( (e as { $metadata?: { httpStatusCode?: number }} ).$metadata?.httpStatusCode )
      : undefined;
    const msg = httpStatus === 404 ? 'Plik nie istnieje' : 'Błąd zmiany nazwy';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
