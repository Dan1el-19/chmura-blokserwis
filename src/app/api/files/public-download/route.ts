import { NextRequest, NextResponse } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { checkRateLimit } from '@/lib/rateLimit';

export async function GET(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'files-public-download', 60, 60_000); // 60 req / min
    if (!rl.ok) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429, headers: { 'Retry-After': rl.retryAfter.toString() } });
    }
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    
    if (!slug) {
      return NextResponse.json({ error: 'Brak slug' }, { status: 400 });
    }

    // Sprawdź czy link istnieje i jest ważny
  const db = adminDb;
  if (!db) return NextResponse.json({ error: 'Firestore not initialized' }, { status: 500 });
    const doc = await db.collection('sharedFiles').doc(slug).get();
    if (!doc.exists) {
      return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });
    }

    const data = doc.data() as { 
      key: string; 
      fileName: string;
      originalName: string;
      expiresAt?: Timestamp | Date;
    } | undefined;
    
    if (!data?.key) {
      return NextResponse.json({ error: 'Nieprawidłowy wpis' }, { status: 400 });
    }

    // Sprawdź czy link nie wygasł
    const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : data.expiresAt;
    if (expiresAt && expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Link wygasł' }, { status: 410 });
    }

    // Generuj presigned URL zamiast streamowania przez serwer
    const { generatePresignedUrl } = await import('@/lib/storage');
    
    // Użyj oryginalnej nazwy pliku jeśli dostępna
    const fileName = data.originalName || data.fileName || data.key.split('/').pop() || 'file';
    
    // Generuj presigned URL z Content-Disposition
    const responseParams = {
      'response-content-disposition': `attachment; filename="${encodeURIComponent(fileName)}"`
    };
    
    const presignedUrl = await generatePresignedUrl(data.key, 'get', 300, responseParams);
    
    // Zwróć presigned URL zamiast streamowania
    return NextResponse.json({ 
      presignedUrl,
      fileName,
      originalName: data.originalName 
    });
  } catch (error) {
    console.error('Error in files/public-download API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
