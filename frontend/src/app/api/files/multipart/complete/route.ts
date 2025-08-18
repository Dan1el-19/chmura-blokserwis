import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { CompleteMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { checkRateLimit } from '@/lib/rateLimit';
import { completeSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
  try {
    // Rate limit: per IP 30 req/60s
    const rl = checkRateLimit(request, 'multipart-complete', 30, 60_000);
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
    const parsed = completeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Nieprawidłowe dane', details: parsed.error.flatten() }, { status: 400 });
    }
    const { uploadId, parts } = parsed.data;

    // wymagane pola zweryfikowane przez zod

    // szczegółowa walidacja wykonana przez zod

    console.log('Completing multipart upload:', { uploadId, partsCount: parts.length });

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

    // Finalizuj multipart upload w R2
    const client = initializeS3Client();
    const bucket = getBucketName();

    // Upewnij się, że części są posortowane według PartNumber
    type Part = { PartNumber: number; ETag: string };
    const sortedParts = (parts as Part[]).slice().sort((a: Part, b: Part) => a.PartNumber - b.PartNumber).map((part: Part) => ({
      PartNumber: part.PartNumber,
      ETag: part.ETag,
    }));

    const command = new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: uploadData.key,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: sortedParts,
      },
    });

    console.log('Completing multipart upload with parts (sorted):', sortedParts);

    let result;
    try {
      result = await client.send(command);
    } catch (sendError) {
      console.error('Error sending CompleteMultipartUploadCommand:', sendError);
      return NextResponse.json({ error: 'Błąd podczas finalizacji uploadu (R2)' }, { status: 500 });
    }

    console.log('R2 complete response:', {
      location: result.Location,
      etag: result.ETag,
      bucket: result.Bucket,
      key: result.Key
    });

    console.log('Upload data before Firestore update:', uploadData);

    // If Location is missing, continue if we have Key or ETag
    if (!result.Location && !result.Key && !result.ETag) {
      console.error('R2 complete response missing Location/Key/ETag:', result);
      return NextResponse.json({ error: 'Nie udało się finalizować uploadu - brak poprawnej odpowiedzi od R2' }, { status: 500 });
    }

    // Aktualizuj status uploadu w Firestore (otoczony try/catch by logować problemy)
    try {
      await db.collection('multipartUploads').doc(uploadId).update({
        status: 'completed',
        completedAt: FieldValue.serverTimestamp(),
        location: result.Location || result.Key || null,
        etag: result.ETag || null,
      });
    } catch (fsError) {
      console.error('Error updating Firestore for upload complete:', fsError);
      return NextResponse.json({ error: 'Błąd podczas aktualizacji bazy danych' }, { status: 500 });
    }

    // Aktualizuj używaną przestrzeń w profilu użytkownika (transakcyjnie)
    if (uploadData.folder === 'personal') {
      const userDocRef = db.doc(`users/${decodedToken.uid}`);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(userDocRef);
        const prev = snap.exists ? (snap.data()?.storageUsed || 0) : 0;
        const next = (prev as number) + (uploadData.fileSize as number);
        tx.set(userDocRef, { storageUsed: next, lastLogin: FieldValue.serverTimestamp() }, { merge: true });
      });
    }

    // Log activity
    await db.collection('activityLogs').add({
      userId: decodedToken.uid,
      userEmail: decodedToken.email || '',
      action: 'upload',
      fileName: uploadData.fileName,
      fileSize: uploadData.fileSize,
      folder: uploadData.folder,
      key: uploadData.key,
      timestamp: FieldValue.serverTimestamp(),
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
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
