import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { adminUpdateUserSchema } from '@/lib/validation';

export async function PUT(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Brak tokenu autoryzacji' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = await verifyToken(token);
    if (!decoded) return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
    if (decoded.role !== 'admin') return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });

    const body = await request.json();
    const parsed = adminUpdateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Nieprawidłowe dane', details: parsed.error.flatten() }, { status: 400 });
    }
    const { uid, role, storageLimit } = parsed.data;

    const db = getFirestore();
    const update: Record<string, unknown> = {};
    if (typeof storageLimit === 'number' && storageLimit > 0) update.storageLimit = storageLimit;
    if (role) update.role = role;
    if (Object.keys(update).length > 0) {
      await db.doc(`users/${uid}`).set(update, { merge: true });
    }
    if (role) {
      await getAuth().setCustomUserClaims(uid, { role });
    }

    // Audit log
    try {
      const db2 = getFirestore();
      await db2.collection('activityLogs').add({
        userId: decoded.uid,
        action: 'admin_user_update',
        timestamp: Date.now(),
        targetUserId: uid,
        changes: { role, storageLimit }
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('PUT /api/admin/users/update error:', e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}


