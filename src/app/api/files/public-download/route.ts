import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { GetObjectCommand } from '@aws-sdk/client-s3';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    
    if (!slug) {
      return NextResponse.json({ error: 'Brak slug' }, { status: 400 });
    }

    // Sprawdź czy link istnieje i jest ważny
    const db = getFirestore();
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

    // Pobierz plik z S3
    const client = initializeS3Client();
    const bucket = getBucketName();
    const command = new GetObjectCommand({ Bucket: bucket, Key: data.key });
    
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

    // Użyj oryginalnej nazwy pliku jeśli dostępna
    const fileName = data.originalName || data.fileName || data.key.split('/').pop() || 'file';

    // Zwróć plik z odpowiednimi nagłówkami do wymuszenia pobierania
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': response.ContentType || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileName)}"`,
        'Content-Length': buffer.length.toString(),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Error in files/public-download API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
