import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { generatePresignedUrl } from '@/lib/storage';

// Public endpoint to resolve pretty file links: /files/[slug]
export async function GET(request: NextRequest) {
  try {
    const { searchParams, pathname } = new URL(request.url);
    // Support both /api/files/shared?slug=... and pretty route mapping (when proxied)
    const slug = searchParams.get('slug') || pathname.split('/').pop() || '';
    if (!slug) return NextResponse.json({ error: 'Brak slug' }, { status: 400 });

    const db = getFirestore();
    const doc = await db.collection('sharedFiles').doc(slug).get();
    if (!doc.exists) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });

    const data = doc.data() as { 
      key: string; 
      fileName: string;
      originalName: string;
      name?: string;
      createdAt?: Timestamp | Date;
      expiresAt?: Timestamp | Date;
      owner: string;
    } | undefined;
    
    if (!data?.key) return NextResponse.json({ error: 'Nieprawidłowy wpis' }, { status: 400 });

    // Check expiration
    const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : data.expiresAt;
    if (expiresAt && expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Link wygasł' }, { status: 410 });
    }

    const downloadUrl = await generatePresignedUrl(data.key, 'get', 60); // short-lived presign
    
    // Zaloguj użycie linku
    try {
      await db.collection('linkUsage').add({
        linkId: slug,
        linkName: data.name || 'Bez nazwy',
        fileName: data.fileName || data.key.split('/').pop() || 'file',
        owner: data.owner,
        accessedAt: FieldValue.serverTimestamp(),
        userAgent: request.headers.get('user-agent') || 'unknown',
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown'
      });
    } catch (error) {
      console.error('Error logging link usage:', error);
      // Nie przerywamy działania jeśli logowanie się nie powiedzie
    }
    
    // Przygotuj dane pliku
    const fileData = {
      key: data.key,
      fileName: data.fileName || data.key.split('/').pop() || 'file',
      originalName: data.originalName || data.fileName || data.key.split('/').pop() || 'file',
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : data.createdAt || new Date(),
      expiresAt: expiresAt || new Date(),
      owner: data.owner || 'unknown'
    };

    return NextResponse.json({ 
      fileData,
      downloadUrl
    });
  } catch (e) {
    console.error('GET /api/files/shared error:', e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
