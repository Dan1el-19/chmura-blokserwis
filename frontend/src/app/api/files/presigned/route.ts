import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { generatePresignedUrl } from '@/lib/storage';
import { getFirestore } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
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
    const op = (searchParams.get('op') || 'get') as 'get' | 'put';
    if (!key) {
      return NextResponse.json({ error: 'Brak klucza pliku' }, { status: 400 });
    }

    // Sprawdź czy użytkownik ma dostęp do tego pliku
    const userPrefix = `users/${decodedToken.uid}/`;
    if (!key.startsWith(userPrefix)) {
      // Sprawdź czy to plik z folderu main (dla użytkowników z uprawnieniami)
      if (!key.startsWith('main/')) {
        return NextResponse.json({ error: 'Brak dostępu do pliku' }, { status: 403 });
      }
    }

    // Dla uploadów do personal folderu, sprawdź limit i zaktualizuj licznik po stronie klienta po complete
    if (op === 'put' && key.startsWith('users/')) {
      // (opcjonalnie) można dodać soft-check rozmiaru przez nagłówek x-file-size
    }

    // Generuj presigned URL (PUT lub GET)
    const presignedUrl = await generatePresignedUrl(key, op, 300); // 5 minut
    
    return NextResponse.json({ presignedUrl });
  } catch (error) {
    console.error('Error in files/presigned API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
