import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { ActivityLog } from '@/types';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

export async function GET(request: NextRequest) {
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

    const decoded = await verifyToken(authHeader.split('Bearer ')[1]);
    if (!decoded || decoded.role !== 'admin') {
      return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });
    }

    const db = getFirestore();
    const snap = await db
      .collection('activityLogs')
      .orderBy('timestamp', 'desc')
      .limit(500)
      .get();

    const logs: ActivityLog[] = snap.docs.map((d) => {
      const data = d.data() as Record<string, unknown>;
      return {
        id: d.id,
        userId: String(data.userId || ''),
        userEmail: String(data.userEmail || ''),
        action: data.action as ActivityLog['action'],
        fileName: data.fileName as string | undefined,
        fileSize: (data.fileSize as number | undefined) ?? undefined,
        timestamp: (data.timestamp as Timestamp | Date | undefined) instanceof Timestamp
          ? (data.timestamp as Timestamp).toDate()
          : ((data.timestamp as Date | undefined) ?? new Date()),
        ipAddress: data.ipAddress as string | undefined,
      };
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error('Error in admin logs API:', error);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}



