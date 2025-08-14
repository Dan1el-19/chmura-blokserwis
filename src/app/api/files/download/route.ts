import { NextRequest, NextResponse } from 'next/server';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { generatePresignedUrl } from '@/lib/storage';

// Public endpoint to resolve pretty file links: /files/[slug]
export async function GET(request: NextRequest) {
  try {
    const { searchParams, pathname } = new URL(request.url);
    // Support both /api/files/download?slug=... and pretty route mapping (when proxied)
    const slug = searchParams.get('slug') || pathname.split('/').pop() || '';
    if (!slug) return NextResponse.json({ error: 'Brak slug' }, { status: 400 });

    const db = getFirestore();
    const doc = await db.collection('sharedFiles').doc(slug).get();
    if (!doc.exists) return NextResponse.json({ error: 'Nie znaleziono' }, { status: 404 });

    const data = doc.data() as { key: string; expiresAt?: Timestamp | Date } | undefined;
    if (!data?.key) return NextResponse.json({ error: 'Nieprawidłowy wpis' }, { status: 400 });

    // Check expiration
    const expiresAt = data.expiresAt instanceof Timestamp ? data.expiresAt.toDate() : data.expiresAt;
    if (expiresAt && expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: 'Link wygasł' }, { status: 410 });
    }

    const url = await generatePresignedUrl(data.key, 'get', 60); // short-lived presign
    return new NextResponse(url, { status: 200 });
  } catch (e) {
    console.error('GET /api/files/download error:', e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}


