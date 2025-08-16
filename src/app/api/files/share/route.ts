import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

// Funkcja do generowania czytelnego slug
function generateReadableSlug(fileName: string): string {
  // Usuń rozszerzenie pliku
  const nameWithoutExt = fileName.replace(/\.[^/.]+$/, '');
  
  // Zamień spacje i znaki specjalne na myślniki
  const cleanName = nameWithoutExt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Usuń znaki specjalne
    .replace(/\s+/g, '-') // Zamień spacje na myślniki
    .replace(/-+/g, '-') // Usuń wielokrotne myślniki
    .trim();
  
  // Dodaj timestamp aby uniknąć kolizji
  const timestamp = Date.now().toString(36);
  
  return `${cleanName}-${timestamp}`;
}

// Funkcja do sprawdzenia czy slug już istnieje
async function checkSlugExists(slug: string): Promise<boolean> {
  const db = getFirestore();
  const doc = await db.collection('sharedFiles').doc(slug).get();
  return doc.exists;
}

export async function POST(request: NextRequest) {
  try {
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
    const { key, expiresIn, expiresAt: customExpiresAt, name } = body;

    if (!key) {
      return NextResponse.json({ error: 'Brak klucza pliku' }, { status: 400 });
    }

    // Sprawdź uprawnienia do pliku
    if (!key.startsWith(`users/${decodedToken.uid}/`) && !key.startsWith('main/')) {
      return NextResponse.json({ error: 'Brak uprawnień do pliku' }, { status: 403 });
    }

    // Generuj czytelny slug
    const fileName = key.split('/').pop() || 'file';
    let slug = generateReadableSlug(fileName);
    
    // Sprawdź czy slug już istnieje i dodaj licznik jeśli tak
    let counter = 1;
    while (await checkSlugExists(slug)) {
      slug = `${generateReadableSlug(fileName)}-${counter}`;
      counter++;
    }

    // Oblicz datę wygaśnięcia
    let expiresAt: Date;
    if (customExpiresAt) {
      // Jeśli podano konkretną datę
      expiresAt = new Date(customExpiresAt);
    } else if (expiresIn) {
      // Jeśli podano czas względny (w sekundach)
      expiresAt = new Date(Date.now() + expiresIn * 1000);
    } else {
      // Domyślnie 24 godziny
      expiresAt = new Date(Date.now() + 86400 * 1000);
    }

    // Zapisz w Firestore
    const db = getFirestore();
    await db.collection('sharedFiles').doc(slug).set({
      key,
      fileName,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      owner: decodedToken.uid,
      originalName: fileName,
      name: name || 'Bez nazwy', // Dodaj nazwę linku
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://chmura.blokserwis.pl';
    const prettyUrl = `${baseUrl}/files/${slug}`;

    // Log share
    try {
      await db.collection('activityLogs').add({
        userId: decodedToken.uid,
        userEmail: decodedToken.email || '',
        action: 'share',
        fileName: fileName,
        timestamp: FieldValue.serverTimestamp(),
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



