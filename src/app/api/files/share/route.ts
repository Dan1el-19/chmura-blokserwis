import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db as adminDb } from '@/lib/firebaseAdmin';
import { shareSchema } from '@/lib/validation';
import { checkRateLimit } from '@/lib/rateLimit';

function generateReadableSlug(fileName: string): string {
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  const cleanName = nameWithoutExt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
  const base = cleanName.slice(0, 12).replace(/-$/,'');
  const rand = Math.random().toString(36).slice(2, 9); 
  let hash = 0;
  for (let i = 0; i < rand.length; i++) hash = (hash * 31 + rand.charCodeAt(i)) >>> 0;
  const chk = (hash % 1296).toString(36).padStart(2, '0'); 
  return `${base ? base + '-' : ''}${rand}${chk}`;
}
async function checkSlugExists(slug: string): Promise<boolean> {
  const db = adminDb;
  if (!db) return false;
  const doc = await db.collection('sharedFiles').doc(slug).get();
  return doc.exists;
}

export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'files-share', 30, 60_000);
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

    const body = await request.json();
    const parsed = shareSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Nieprawidłowe dane', details: parsed.error.flatten() }, { status: 400 });
    }
    const { key, expiresIn, expiresAt: customExpiresAt, name, customSlug } = parsed.data;


    if (!key.startsWith(`users/${decodedToken.uid}/`) && !key.startsWith('main/')) {
      return NextResponse.json({ error: 'Brak uprawnień do pliku' }, { status: 403 });
    }

    const fileName = key.split('/').pop() || 'file';
    let slug: string;
    
    if (customSlug) {
      if (await checkSlugExists(customSlug)) {
        return NextResponse.json({ error: 'Ten niestandardowy link jest już zajęty' }, { status: 409 });
      }
      slug = customSlug;
    } else {
      // Generuj automatyczny slug
      slug = generateReadableSlug(fileName);
      while (await checkSlugExists(slug)) {
        slug = generateReadableSlug(fileName);
      }
    }

    let expiresAt: Date;
    if (customExpiresAt) {
      expiresAt = new Date(customExpiresAt);
    } else if (expiresIn) {
      expiresAt = new Date(Date.now() + expiresIn * 1000);
    } else {
      expiresAt = new Date(Date.now() + 86400 * 1000);
    }
  const db = adminDb;
  if (!db) return NextResponse.json({ error: 'Firestore not initialized' }, { status: 500 });
    await db.collection('sharedFiles').doc(slug).set({
      key,
      fileName,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      owner: decodedToken.uid,
      originalName: fileName,
      name: name || 'Bez nazwy',
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://chmura.blokserwis.pl';
    const prettyUrl = `${baseUrl}/files/${slug}`;

    try {
      await db.collection('activityLogs').add({
        userId: decodedToken.uid,
        userEmail: decodedToken.email || '',
        action: 'share',
        fileName: fileName,
        key,
        timestamp: FieldValue.serverTimestamp(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });
    } catch {}

    console.log('Share API success:', { url: prettyUrl, slug, expiresIn, expiresAt, name });
    
    return NextResponse.json({ 
      url: prettyUrl,
      slug: slug,
      expiresIn,
      expiresAt,
      name: name || 'Bez nazwy'
    });
  } catch (error) {
    console.error('Error in share API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}



