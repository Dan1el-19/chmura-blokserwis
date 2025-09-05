import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { db } from '@/lib/firebaseAdmin';
import { FieldValue } from 'firebase-admin/firestore';

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
    const { fileName, fileSize, key, folder, subPath } = body;

    if (!fileName || !fileSize || !key || !folder) {
      return NextResponse.json({ error: 'Brak wymaganych danych' }, { status: 400 });
    }

    // Verify user has access to this key
    const userPrefix = `users/${decodedToken.uid}/`;
    if (!key.startsWith(userPrefix) && !key.startsWith('main/')) {
      return NextResponse.json({ error: 'Brak dostępu' }, { status: 403 });
    }

    // Record upload in Firestore
    if (!db) {
      throw new Error('Database not initialized');
    }
    
    await db.collection('uploadHistory').add({
      userId: decodedToken.uid,
      action: 'upload_completed',
      fileName,
      fileSize,
      folder,
      key,
      subPath: subPath || null,
      timestamp: FieldValue.serverTimestamp(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // Update user's storage usage for personal folder
    if (folder === 'personal') {
      const userDocRef = db.doc(`users/${decodedToken.uid}`);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userDocRef);
        const prev = snap.exists ? (snap.data()?.storageUsed || 0) : 0;
        const next = (prev as number) + fileSize;
        tx.set(userDocRef, { 
          storageUsed: next, 
          lastLogin: FieldValue.serverTimestamp() 
        }, { merge: true });
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error recording upload:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
