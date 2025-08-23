import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { checkRateLimit } from '@/lib/rateLimit';

/**
 * Admin-only: abortuje nieukończone multipart uploady starsze niż maxAgeHours
 * Można wywoływać ręcznie lub zaplanować jako cron.
 */
export async function POST(request: NextRequest) {
  try {
    const rl = checkRateLimit(request, 'multipart-cleanup', 10, 60_000);
    if (!rl.ok) {
      return NextResponse.json({ error: 'Too Many Requests' }, { status: 429, headers: { 'Retry-After': rl.retryAfter.toString() } });
    }
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Brak tokenu autoryzacji' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });

    // Weryfikacja roli admina
    const db = getFirestore();
    const userDoc = await db.doc(`users/${decoded.uid}`).get();
    const role = (userDoc.exists && (userDoc.data()?.role as string)) || 'basic';
    if (role !== 'admin') return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const maxAgeHours = typeof body.maxAgeHours === 'number' && body.maxAgeHours > 0 ? body.maxAgeHours : 24;
    const cutoff = Date.now() - maxAgeHours * 60 * 60 * 1000;

    const client = initializeS3Client();
    const bucket = getBucketName();

    const snap = await db
      .collection('multipartUploads')
      .where('status', 'in', ['initiated', 'uploading'])
      .get();

    let scanned = 0;
    let aborted = 0;

    for (const doc of snap.docs) {
      scanned++;
      const data = doc.data() as Record<string, unknown>;
      const uploadId = String(data.uploadId || '');
      const key = String(data.key || '');
      const createdAt = (data.createdAt as { toDate?: () => Date } | undefined)?.toDate?.() || new Date();
      if (!uploadId || !key) continue;
      if (createdAt.getTime() > cutoff) continue; // za nowe

      try {
        await client.send(
          new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: key,
            UploadId: uploadId,
          })
        );
      } catch {
        // kontynuuj mimo błędów R2, i tak oznacz jako aborted w Firestore
      }

      await doc.ref.update({ status: 'aborted', abortedAt: FieldValue.serverTimestamp() });
      aborted++;
    }

    return NextResponse.json({ success: true, scanned, aborted, maxAgeHours });
  } catch (error) {
    console.error('Error in multipart cleanup:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}


