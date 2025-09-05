import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/firebaseAdmin';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { ListPartsCommand } from '@aws-sdk/client-s3';
import { Part } from '@/types/multipart';

export async function GET(request: NextRequest) {
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

    // Pobierz query parameters
    const { searchParams } = new URL(request.url);
    const uploadId = searchParams.get('uploadId');
    const key = searchParams.get('key');

    // Walidacja
    if (!uploadId || !key) {
      return NextResponse.json({ 
        error: 'Missing required query parameters: uploadId, key' 
      }, { status: 400 });
    }

    // Inicjalizuj S3 client
    const s3Client = initializeS3Client();
    const bucketName = getBucketName();

    // Stwórz ListPartsCommand
    const listPartsCommand = new ListPartsCommand({
      Bucket: bucketName,
      Key: key,
      UploadId: uploadId
    });

    // Pobierz listę części z R2
    const result = await s3Client.send(listPartsCommand);

    // Konwertuj R2 parts na nasze typy
    const parts: Part[] = (result.Parts || []).map(r2Part => ({
      partNumber: r2Part.PartNumber || 0,
      etag: (r2Part.ETag || '').replace(/"/g, ''), // Remove quotes from ETag
      size: r2Part.Size || 0,
      uploadedAt: r2Part.LastModified || new Date(),
      status: 'completed' // R2 parts są zawsze completed
    }));

    // Sortuj według partNumber
    parts.sort((a, b) => a.partNumber - b.partNumber);

    // Zwróć odpowiedź
    return NextResponse.json({
      parts,
      uploadId,
      key,
      totalParts: parts.length,
      bucket: bucketName,
      initiated: new Date(), // AWS SDK v3 nie ma Initiated property
      owner: result.Owner,
      storageClass: result.StorageClass
    });

  } catch {
    console.error('Error listing parts');
    
    return NextResponse.json({ 
      error: 'Failed to list parts' 
    }, { status: 500 });
  }
}
