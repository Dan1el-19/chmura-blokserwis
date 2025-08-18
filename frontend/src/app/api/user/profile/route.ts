import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { listFiles } from '@/lib/storage';

type UserDoc = {
  role?: 'basic' | 'plus' | 'admin';
  storageLimit?: number;
  storageUsed?: number;
  createdAt?: Timestamp;
  lastLogin?: Timestamp;
};

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

    const db = getFirestore();

    // Rola z custom claims lub z Firestore
    let role = (decodedToken.role as 'basic' | 'plus' | 'admin') || 'basic';
    let storageLimit = 5 * 1024 * 1024 * 1024; // 5GB

    const userDocRef = db.doc(`users/${decodedToken.uid}`);
    const userSnap = await userDocRef.get();
    if (userSnap.exists) {
      const data = userSnap.data() as UserDoc;
      if (data.role) role = data.role;
      if (typeof data.storageLimit === 'number') storageLimit = data.storageLimit;
    }

    // Oblicz rzeczywistą używaną przestrzeń
    let storageUsed = 0;
    try {
      const prefix = `users/${decodedToken.uid}/`;
      const objects = await listFiles(prefix);
      storageUsed = objects.reduce((total, obj) => total + (obj.Size || 0), 0);
      
      // Aktualizuj w Firestore jeśli się zmieniło
      const currentStorageUsed = userSnap.exists ? (userSnap.data() as UserDoc).storageUsed || 0 : 0;
      if (storageUsed !== currentStorageUsed) {
        await userDocRef.set({ storageUsed }, { merge: true });
      }
    } catch (error) {
      console.error('Error calculating storage used:', error);
      // Użyj wartości z Firestore jako fallback
      if (userSnap.exists) {
        const data = userSnap.data() as UserDoc;
        storageUsed = data.storageUsed || 0;
      }
    }

    const userProfile = {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name || decodedToken.email,
      role,
      storageLimit,
      storageUsed,
      createdAt: userSnap.exists && userSnap.get('createdAt') ? (userSnap.get('createdAt') as Timestamp).toDate?.() ?? new Date() : new Date(),
      lastLogin: new Date()
    };

    return NextResponse.json(userProfile);
  } catch (error) {
    console.error('Error in profile API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

