import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { getFirestore } from 'firebase-admin/firestore';

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
    const { uploadId, partNumber, key } = body;

    if (!uploadId || !partNumber || !key) {
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

    // Generuj presigned URL dla części
    const client = initializeS3Client();
    const bucket = getBucketName();

    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    });

    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 3600 }); // 1 godzina

    return NextResponse.json({
      presignedUrl,
      partNumber,
    });
  } catch (error) {
    console.error('Error in multipart part-url:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
