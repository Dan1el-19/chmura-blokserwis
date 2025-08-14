import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

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
    let storageUsed = 0;

    const userDocRef = db.doc(`users/${decodedToken.uid}`);
    const userSnap = await userDocRef.get();
    if (userSnap.exists) {
      const data = userSnap.data() as UserDoc;
      if (data.role) role = data.role;
      if (typeof data.storageLimit === 'number') storageLimit = data.storageLimit;
      if (typeof data.storageUsed === 'number') storageUsed = data.storageUsed;
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

