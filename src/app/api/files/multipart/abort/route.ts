import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
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
    const { uploadId } = body;

    if (!uploadId) {
      return NextResponse.json({ error: 'Brak ID uploadu' }, { status: 400 });
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

    if (uploadData.status === 'completed' || uploadData.status === 'aborted') {
      return NextResponse.json({ error: 'Upload już został zakończony' }, { status: 400 });
    }

    // Anuluj multipart upload w R2
    const client = initializeS3Client();
    const bucket = getBucketName();

    const command = new AbortMultipartUploadCommand({
      Bucket: bucket,
      Key: uploadData.key,
      UploadId: uploadId,
    });

    await client.send(command);

    // Aktualizuj status uploadu w Firestore
    await db.collection('multipartUploads').doc(uploadId).update({
      status: 'aborted',
      abortedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in multipart abort:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
