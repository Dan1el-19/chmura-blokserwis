import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { UploadPartCommand } from '@aws-sdk/client-s3';

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
    const uploadId = formData.get('uploadId') as string;
    const partNumber = parseInt(formData.get('partNumber') as string);
    const key = formData.get('key') as string;

    if (!file || !uploadId || !partNumber || !key) {
      return NextResponse.json({ error: 'Brak wymaganych parametrów' }, { status: 400 });
    }

    console.log('Uploading part via proxy:', { uploadId, partNumber, key, fileSize: file.size });

    // Konwertuj File na Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload części do R2
    const client = initializeS3Client();
    const bucket = getBucketName();
    
    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
      Body: buffer,
      ContentLength: buffer.length
    });

    const result = await client.send(command);

    if (!result.ETag) {
      return NextResponse.json({ error: 'Brak ETag z R2' }, { status: 500 });
    }

    // Usuń cudzysłowy z ETag
    const cleanEtag = result.ETag.replace(/"/g, '');

    console.log(`Part ${partNumber} uploaded successfully via proxy, ETag: ${cleanEtag}`);

    return NextResponse.json({ 
      etag: cleanEtag,
      partNumber,
      size: buffer.length
    });

  } catch (error) {
    console.error('Error uploading part via proxy:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Nieznany błąd' 
    }, { status: 500 });
  }
}
