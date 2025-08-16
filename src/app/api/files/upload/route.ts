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

    if (!file) {
      return NextResponse.json({ error: 'Brak pliku' }, { status: 400 });
    }

    // Sprawdź limit miejsca
    if (folder === 'personal') {
      const db = getFirestore();
      const userDocRef = db.doc(`users/${decodedToken.uid}`);
      const userSnap = await userDocRef.get();
      
      let storageLimit = 5 * 1024 * 1024 * 1024; // 5GB default
      if (userSnap.exists) {
        const data = userSnap.data();
        if (typeof data?.storageLimit === 'number') {
          storageLimit = data.storageLimit;
        }
      }

      // Oblicz aktualnie używaną przestrzeń
      const prefix = `users/${decodedToken.uid}/`;
      const objects = await listFiles(prefix);
      const currentStorageUsed = objects.reduce((total, obj) => total + (obj.Size || 0), 0);
      
      // Sprawdź czy plik się zmieści
      if (currentStorageUsed + file.size > storageLimit) {
        return NextResponse.json({ 
          error: `Brak miejsca. Używasz ${formatBytes(currentStorageUsed)} z ${formatBytes(storageLimit)}. Potrzebujesz jeszcze ${formatBytes(file.size)}.` 
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
    const key = folder === 'personal'
      ? `users/${decodedToken.uid}/${file.name}`
      : `main/${file.name}`;

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
        timestamp: FieldValue.serverTimestamp(),
      });

      // Aktualizuj używaną przestrzeń w profilu użytkownika
      if (folder === 'personal') {
        const userDocRef = db.doc(`users/${decodedToken.uid}`);
        const userSnap = await userDocRef.get();
        const currentStorageUsed = userSnap.exists ? (userSnap.data()?.storageUsed || 0) : 0;
        await userDocRef.set({ 
          storageUsed: currentStorageUsed + file.size,
          lastLogin: FieldValue.serverTimestamp()
        }, { merge: true });
      }
    } catch {}

    return NextResponse.json({ success: true, key, fileName: file.name, fileSize: file.size });
  } catch (error) {
    console.error('Error in upload API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
