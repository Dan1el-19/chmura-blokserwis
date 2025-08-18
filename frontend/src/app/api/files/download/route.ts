import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { downloadSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'files-download', 60, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429, headers: { 'Retry-After': rl.retryAfter.toString() } });
    }
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Brak tokenu autoryzacji' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyToken(token);
    
    if (!decodedToken) {
      return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const keyParam = searchParams.get('key');
    const parsed = downloadSchema.safeParse({ key: keyParam });
    if (!parsed.success) {
      return NextResponse.json({ error: 'Brak lub nieprawidłowy klucz pliku' }, { status: 400 });
    }
    const { key } = parsed.data;

    // Sprawdź czy użytkownik ma dostęp do tego pliku
    const userPrefix = `users/${decodedToken.uid}/`;
    if (!key.startsWith(userPrefix)) {
      // Sprawdź czy to plik z folderu main (dla użytkowników z uprawnieniami)
      if (!key.startsWith('main/')) {
        return NextResponse.json({ error: 'Brak dostępu do pliku' }, { status: 403 });
      }
    }

    // Pobierz plik z S3
    const client = initializeS3Client();
    const bucket = getBucketName();
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    
    const response = await client.send(command);
    
    if (!response.Body) {
      return NextResponse.json({ error: 'Plik nie istnieje' }, { status: 404 });
    }

    // Konwertuj stream na buffer
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // Pobierz nazwę pliku z klucza
    const fileName = key.split('/').pop() || 'file';

    // Zwróć plik z odpowiednimi nagłówkami do wymuszenia pobierania
    const res = new NextResponse(buffer, {
      headers: {
        'Content-Type': response.ContentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
    // Opcjonalny log pobrania (nie ciężki)
    try {
      const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
      const db = getFirestore();
      await db.collection('activityLogs').add({
        userId: decodedToken.uid,
        userEmail: decodedToken.email || '',
        action: 'download',
        fileName,
        key,
        timestamp: FieldValue.serverTimestamp(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    } catch {}
    return res;
  } catch (error) {
    console.error('Error in files/download API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}


