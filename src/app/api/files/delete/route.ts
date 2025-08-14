import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { deleteFile } from '@/lib/storage';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Brak klucza pliku' }, { status: 400 });
    }

    // Sprawdź uprawnienia do pliku
    if (!key.startsWith(`users/${decodedToken.uid}/`) && !key.startsWith('main/')) {
      return NextResponse.json({ error: 'Brak uprawnień do pliku' }, { status: 403 });
    }

    // Usuń plik
    await deleteFile(key);

    // Log delete
    try {
      const db = getFirestore();
      await db.collection('activityLogs').add({
        userId: decodedToken.uid,
        userEmail: decodedToken.email || '',
        action: 'delete',
        fileName: key.split('/').pop(),
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}



