import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
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
    const { uploadId, parts } = body;

    if (!uploadId || !parts || !Array.isArray(parts)) {
      return NextResponse.json({ error: 'Brak wymaganych parametrów' }, { status: 400 });
    }

    // Sprawdź czy upload należy do użytkownika
    const db = getFirestore();
    const uploadDoc = await db.collection('multipartUploads').doc(uploadId).get();
    
    if (!uploadDoc.exists) {
      return NextResponse.json({ error: 'Upload nie istnieje' }, { status: 404 });
    }

    const uploadData = uploadDoc.data();
    if (!uploadData || uploadData.userId !== decodedToken.uid) {
      return NextResponse.json({ error: 'Brak uprawnień do tego uploadu' }, { status: 403 });
    }

    if (uploadData.status !== 'initiated' && uploadData.status !== 'uploading') {
      return NextResponse.json({ error: 'Upload nie jest aktywny' }, { status: 400 });
    }

    // Finalizuj multipart upload w R2
    const client = initializeS3Client();
    const bucket = getBucketName();

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: uploadData.key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((part: { PartNumber: number; ETag: string }) => ({
          PartNumber: part.PartNumber,
          ETag: part.ETag,
        })),
      },
    });

    const result = await client.send(command);

    if (!result.Location) {
      return NextResponse.json({ error: 'Nie udało się finalizować uploadu' }, { status: 500 });
    }

    // Aktualizuj status uploadu w Firestore
    await db.collection('multipartUploads').doc(uploadId).update({
      status: 'completed',
      completedAt: FieldValue.serverTimestamp(),
      location: result.Location,
      etag: result.ETag,
    });

    // Aktualizuj używaną przestrzeń w profilu użytkownika
    if (uploadData.folder === 'personal') {
      const userDocRef = db.doc(`users/${decodedToken.uid}`);
      const userSnap = await userDocRef.get();
      const currentStorageUsed = userSnap.exists ? (userSnap.data()?.storageUsed || 0) : 0;
      const newStorageUsed = currentStorageUsed + uploadData.fileSize;
      await userDocRef.set({ 
        storageUsed: newStorageUsed,
        lastLogin: FieldValue.serverTimestamp()
      }, { merge: true });
    }

    // Log activity
    await db.collection('activityLogs').add({
      userId: decodedToken.uid,
      userEmail: decodedToken.email || '',
      action: 'upload',
      fileName: uploadData.fileName,
      fileSize: uploadData.fileSize,
      folder: uploadData.folder,
      timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({
      success: true,
      location: result.Location,
      etag: result.ETag,
      key: uploadData.key,
    });
  } catch (error) {
    console.error('Error in multipart complete:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
