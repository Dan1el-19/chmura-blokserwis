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

    // Pobierz rozmiar pliku przed usunięciem
    let fileSize = 0;
    try {
      const { listFiles } = await import('@/lib/storage');
      const objects = await listFiles(key);
      if (objects.length > 0) {
        fileSize = objects[0].Size || 0;
      }
    } catch {}

    // Usuń plik
    await deleteFile(key);

    // Log delete and update storage
    try {
      const db = getFirestore();
      await db.collection('activityLogs').add({
        userId: decodedToken.uid,
        userEmail: decodedToken.email || '',
        action: 'delete',
        fileName: key.split('/').pop(),
        fileSize,
        timestamp: FieldValue.serverTimestamp(),
      });

      // Aktualizuj używaną przestrzeń w profilu użytkownika
      if (key.startsWith(`users/${decodedToken.uid}/`)) {
        const userDocRef = db.doc(`users/${decodedToken.uid}`);
        const userSnap = await userDocRef.get();
        const currentStorageUsed = userSnap.exists ? (userSnap.data()?.storageUsed || 0) : 0;
        const newStorageUsed = Math.max(0, currentStorageUsed - fileSize);
        await userDocRef.set({ 
          storageUsed: newStorageUsed,
          lastLogin: FieldValue.serverTimestamp()
        }, { merge: true });
      }
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in delete API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}



