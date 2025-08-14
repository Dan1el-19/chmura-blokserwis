import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { generatePresignedUrl } from '@/lib/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
    const { key, expiresIn = 86400 } = body; // domyślnie 24 godziny

    if (!key) {
      return NextResponse.json({ error: 'Brak klucza pliku' }, { status: 400 });
    }

    // Sprawdź uprawnienia do pliku
    if (!key.startsWith(`users/${decodedToken.uid}/`) && !key.startsWith('main/')) {
      return NextResponse.json({ error: 'Brak uprawnień do pliku' }, { status: 403 });
    }

    // Zapisz ładny slug w Firestore i zwróć estetyczny link
    const db = getFirestore();
    const slugBase = key.split('/').pop() || 'file';
    const slug = `${Date.now().toString(36)}-${slugBase}`.toLowerCase();
    const expiresAt = new Date(Date.now() + expiresIn * 1000);

    await db.collection('sharedFiles').doc(slug).set({
      key,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
      owner: decodedToken.uid,
    });

    const prettyUrl = `/files/${encodeURIComponent(slug)}`;

    // Log share
    try {
      await db.collection('activityLogs').add({
        userId: decodedToken.uid,
        userEmail: decodedToken.email || '',
        action: 'share',
        fileName: key.split('/').pop(),
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch {}

    return NextResponse.json({ 
      url: prettyUrl,
      expiresIn,
      expiresAt
    });
  } catch (error) {
    console.error('Error in share API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}



