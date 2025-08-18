import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { generatePresignedUrl } from '@/lib/storage';

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
    
    if (!key) {
      return NextResponse.json({ error: 'Brak klucza pliku' }, { status: 400 });
    }

    // Sprawdź czy użytkownik ma dostęp do tego pliku
    // Pliki użytkownika zaczynają się od "users/{uid}/"
    const userPrefix = `users/${decodedToken.uid}/`;
    if (!key.startsWith(userPrefix)) {
      // Sprawdź czy to plik z folderu main (dla użytkowników z uprawnieniami)
      if (!key.startsWith('main/')) {
        return NextResponse.json({ error: 'Brak dostępu do pliku' }, { status: 403 });
      }
    }

    // Generuj presigned URL
    const downloadUrl = await generatePresignedUrl(key, 'get', 60); // 60 sekund
    
    return NextResponse.json({ 
      downloadUrl,
      key,
      fileName: key.split('/').pop() || 'file'
    });
  } catch (error) {
    console.error('Error in files/access API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
