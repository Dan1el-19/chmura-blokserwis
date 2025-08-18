import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { listFiles } from '@/lib/storage';

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

    // Sprawdź czy użytkownik jest adminem
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    const userDocRef = db.doc(`users/${decodedToken.uid}`);
    const userSnap = await userDocRef.get();
    
    let userRole = 'basic';
    if (userSnap.exists) {
      const data = userSnap.data();
      if (data?.role) userRole = data.role;
    }
    
    if (userRole !== 'admin') {
      return NextResponse.json({ error: 'Brak uprawnień administratora' }, { status: 403 });
    }

    // Oblicz używaną przestrzeń w folderze main
    const objects = await listFiles('main/');
    const storageUsed = objects.reduce((total, obj) => total + (obj.Size || 0), 0);

    return NextResponse.json({
      storageUsed,
      fileCount: objects.length
    });
  } catch (error) {
    console.error('Error in main-storage API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
