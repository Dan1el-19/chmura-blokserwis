import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { listFiles } from '@/lib/storage';
import { FileItem } from '@/types';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
    const folder = searchParams.get('folder') || 'personal';
    
    // Sprawdź uprawnienia do folderu
    if (folder === 'main') {
      // Tutaj sprawdź czy użytkownik ma rolę plus lub admin
      // Na razie pozwalamy wszystkim
    }

    const prefix = folder === 'personal' ? `users/${decodedToken.uid}/` : 'main/';
    const objects = await listFiles(prefix);

    const files: FileItem[] = objects.map(obj => ({
      key: obj.Key!,
      name: obj.Key!.split('/').pop() || '',
      size: obj.Size || 0,
      lastModified: obj.LastModified || new Date(),
      contentType: 'application/octet-stream',
      owner: decodedToken.uid,
      path: obj.Key!
    }));

    // Log view action for admin insight
    try {
      const db = getFirestore();
      await db.collection('activityLogs').add({
        userId: decodedToken.uid,
        userEmail: decodedToken.email || '',
        action: 'download',
        fileName: undefined,
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch {}

    return NextResponse.json(files);
  } catch (error) {
    console.error('Error in files API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}



