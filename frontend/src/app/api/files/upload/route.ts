import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeS3Client, getBucketName, listFiles } from '@/lib/storage';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
  const folder = (formData.get('folder') as string) || 'personal';
  const rawSubPath = (formData.get('subPath') as string | null) || null;
  const cleanSub = rawSubPath
    ? rawSubPath
      .replace(/^[\\/]+/, '')
      .replace(/\.\./g, '')
      .replace(/[\\]+/g, '/')
      .replace(/\s+$/, '')
      .replace(/^\s+/, '')
    : null;

    if (!file) {
      return NextResponse.json({ error: 'Brak pliku' }, { status: 400 });
    }

    // Sprawdź limit miejsca z wykorzystaniem licznika w Firestore
    if (folder === 'personal') {
      const db = getFirestore();
      const userDocRef = db.doc(`users/${decodedToken.uid}`);
      const userSnap = await userDocRef.get();
      
      let storageLimit = 5 * 1024 * 1024 * 1024; // 5GB default
      let storageUsed = 0;
      if (userSnap.exists) {
        const data = userSnap.data();
        if (typeof data?.storageLimit === 'number') storageLimit = data.storageLimit;
        if (typeof data?.storageUsed === 'number') storageUsed = data.storageUsed;
      }
      
      // Sprawdź czy plik się zmieści
      if (storageUsed + file.size > storageLimit) {
        return NextResponse.json({ 
          error: `Brak miejsca. Używasz ${formatBytes(storageUsed)} z ${formatBytes(storageLimit)}. Potrzebujesz jeszcze ${formatBytes(file.size)}.` 
        }, { status: 413 });
      }
    } else if (folder === 'main') {
      // Sprawdź uprawnienia dla folderu main (plus i admin)
      const db = getFirestore();
      const userDocRef = db.doc(`users/${decodedToken.uid}`);
      const userSnap = await userDocRef.get();
      
      let userRole = 'basic';
      if (userSnap.exists) {
        const data = userSnap.data();
        if (data?.role) userRole = data.role;
      }
      
      if (userRole !== 'admin' && userRole !== 'plus') {
        return NextResponse.json({ error: 'Tylko użytkownicy Plus i Administrator mogą uploadować do folderu głównego' }, { status: 403 });
      }

      // Sprawdź limit folderu main (domyślnie 50GB)
      const mainStorageLimit = 50 * 1024 * 1024 * 1024; // 50GB
      const mainObjects = await listFiles('main/');
      const mainStorageUsed = mainObjects.reduce((total, obj) => total + (obj.Size || 0), 0);
      
      if (mainStorageUsed + file.size > mainStorageLimit) {
        return NextResponse.json({ 
          error: `Brak miejsca w folderze głównym. Używasz ${formatBytes(mainStorageUsed)} z ${formatBytes(mainStorageLimit)}. Potrzebujesz jeszcze ${formatBytes(file.size)}.` 
        }, { status: 413 });
      }
    }

    // Wylicz docelowy klucz w buckecie
    const nested = cleanSub ? cleanSub.replace(/\/$/, '') + '/' : '';
    const key = folder === 'personal'
      ? `users/${decodedToken.uid}/${nested}${file.name}`
      : `main/${nested}${file.name}`;

    // Konwersja File -> Buffer
    const arrayBuffer = await file.arrayBuffer();
    const body = Buffer.from(arrayBuffer);

    // Upload do R2
    const client = initializeS3Client();
    const bucket = getBucketName();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: file.type || 'application/octet-stream',
      })
    );

    // Update activity log and storage used
    try {
      const db = getFirestore();
      await db.collection('activityLogs').add({
        userId: decodedToken.uid,
        userEmail: decodedToken.email || '',
        action: 'upload',
        fileName: file.name,
        fileSize: file.size,
        folder,
  key,
  subPath: cleanSub || null,
        timestamp: FieldValue.serverTimestamp(),
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });

      // Aktualizuj używaną przestrzeń w profilu użytkownika
      if (folder === 'personal') {
        const userDocRef = db.doc(`users/${decodedToken.uid}`);
        await db.runTransaction(async (tx) => {
          const snap = await tx.get(userDocRef);
          const prev = snap.exists ? (snap.data()?.storageUsed || 0) : 0;
          const next = (prev as number) + file.size;
          tx.set(userDocRef, { storageUsed: next, lastLogin: FieldValue.serverTimestamp() }, { merge: true });
        });
      }
    } catch {}

    return NextResponse.json({ success: true, key, fileName: file.name, fileSize: file.size });
  } catch (error) {
    console.error('Error in upload API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
