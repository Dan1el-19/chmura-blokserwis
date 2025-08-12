import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebaseAdmin';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';

export async function POST(request: NextRequest) {
  try {
    // Sprawdź autoryzację
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);
    let decodedToken;
    
    try {
      if (!auth) {
        return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
      }
      decodedToken = await auth.verifyIdToken(token);
  } catch {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Sprawdź czy użytkownik jest zalogowany
    if (!decodedToken.uid) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 });
    }

    // Parsuj body
    const body = await request.json();
    const { uploadId, key } = body;

    // Walidacja
    if (!uploadId || !key) {
      return NextResponse.json({ 
        error: 'Missing required fields: uploadId, key' 
      }, { status: 400 });
    }

    // Inicjalizuj S3 client
    const s3Client = initializeS3Client();
    const bucketName = getBucketName();

    // Stwórz AbortMultipartUploadCommand
    const abortCommand = new AbortMultipartUploadCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId
    });

    // Anuluj upload na R2
    await s3Client.send(abortCommand);

    // Zwróć odpowiedź
    return NextResponse.json({
      status: 'aborted',
      message: 'Multipart upload aborted successfully',
      uploadId,
      key,
      bucket: bucketName,
      abortedAt: new Date().toISOString()
    });

  } catch {
    console.error('Error aborting multipart upload');
    
    return NextResponse.json({ 
      error: 'Failed to abort multipart upload' 
    }, { status: 500 });
  }
}
