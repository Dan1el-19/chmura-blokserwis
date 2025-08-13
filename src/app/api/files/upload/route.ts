import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { initializeS3Client, getBucketName } from '@/lib/storage';
import { PutObjectCommand } from '@aws-sdk/client-s3';
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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) || 'personal';

    if (!file) {
      return NextResponse.json({ error: 'Brak pliku' }, { status: 400 });
    }

    // Wylicz docelowy klucz w buckecie
    const key = folder === 'personal'
      ? `users/${decodedToken.uid}/${file.name}`
      : `main/${file.name}`;

    // Konwersja File -> Buffer
    const arrayBuffer = await file.arrayBuffer();
    const body = Buffer.from(arrayBuffer);

    // Upload do R2
    const client = initializeS3Client();
    const bucket = getBucketName();
    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: file.type || 'application/octet-stream',
      })
    );

    // Update activity log
    try {
      const db = getFirestore();
      await db.collection('activityLogs').add({
        userId: decodedToken.uid,
        userEmail: decodedToken.email || '',
        action: 'upload',
        fileName: file.name,
        fileSize: file.size,
        timestamp: FieldValue.serverTimestamp(),
      });
    } catch {}

    return NextResponse.json({ success: true, key, fileName: file.name, fileSize: file.size });
  } catch (error) {
    console.error('Error in upload API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}
