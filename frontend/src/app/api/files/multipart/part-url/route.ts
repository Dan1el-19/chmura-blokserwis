import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { UploadPartCommand } from '@aws-sdk/client-s3';
import { getFirestore } from 'firebase-admin/firestore';
import { checkRateLimit } from '@/lib/rateLimit';
import { partUrlSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: per IP 60 req/60s
    const rl = checkRateLimit(request, 'multipart-part-url', 60, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429, headers: { 'Retry-After': rl.retryAfter.toString() } });
    }
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
    const parsed = partUrlSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Nieprawidłowe dane', details: parsed.error.flatten() }, { status: 400 });
    }
    const { uploadId, partNumber, key } = parsed.data;

    // wymagane pola zweryfikowane przez zod

    console.log('Generating presigned URL for part:', { uploadId, partNumber, key });

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

    // Dodatkowa weryfikacja uprawnień do folderu 'main'
    if (uploadData.folder === 'main') {
      const userDocRef = db.doc(`users/${decodedToken.uid}`);
      const userSnap = await userDocRef.get();
      let userRole = 'basic';
      if (userSnap.exists) {
        const data = userSnap.data();
        if (data?.role) userRole = data.role;
      }
      if (userRole !== 'admin' && userRole !== 'plus') {
        return NextResponse.json({ error: 'Brak uprawnień do folderu głównego' }, { status: 403 });
      }
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
