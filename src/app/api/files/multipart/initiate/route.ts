import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { CreateMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

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
    const { fileName, fileSize, contentType, folder = 'personal' } = body;

    if (!fileName || !fileSize || !contentType) {
      return NextResponse.json({ error: 'Brak wymaganych parametrów' }, { status: 400 });
    }

    // Sprawdź uprawnienia dla folderu main
    if (folder === 'main') {
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
    }

    // Sprawdź limit miejsca dla folderu personal
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
      const { listFiles } = await import('@/lib/storage');
      const prefix = `users/${decodedToken.uid}/`;
      const objects = await listFiles(prefix);
      const currentStorageUsed = objects.reduce((total, obj) => total + (obj.Size || 0), 0);
      
      if (currentStorageUsed + fileSize > storageLimit) {
        return NextResponse.json({ 
          error: `Brak miejsca. Używasz ${formatBytes(currentStorageUsed)} z ${formatBytes(storageLimit)}. Potrzebujesz jeszcze ${formatBytes(fileSize)}.` 
        }, { status: 413 });
      }
    }

    // Wylicz docelowy klucz w buckecie
    const key = folder === 'personal'
      ? `users/${decodedToken.uid}/${fileName}`
      : `main/${fileName}`;

    // Inicjuj multipart upload w R2
    const client = initializeS3Client();
    const bucket = getBucketName();
    
    const command = new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
    });

    const result = await client.send(command);

    if (!result.UploadId) {
      return NextResponse.json({ error: 'Nie udało się zainicjować uploadu' }, { status: 500 });
    }

    // Zapisz informacje o uploadzie w Firestore
    const db = getFirestore();
    await db.collection('multipartUploads').doc(result.UploadId).set({
      uploadId: result.UploadId,
      userId: decodedToken.uid,
      userEmail: decodedToken.email || '',
      fileName,
      fileSize,
      contentType,
      folder,
      key,
      bucket,
      status: 'initiated',
      createdAt: FieldValue.serverTimestamp(),
      parts: [],
    });

    return NextResponse.json({
      uploadId: result.UploadId,
      key,
      bucket,
    });
  } catch (error) {
    console.error('Error in multipart initiate:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
