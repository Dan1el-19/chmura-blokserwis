import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, DecodedIdToken } from '@/lib/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth, ListUsersResult, UserRecord } from 'firebase-admin/auth';
import { listFiles, deleteFile } from '@/lib/storage';
import { adminCreateUserSchema } from '@/lib/validation';

type Decoded = DecodedIdToken | null;

type UserRow = {
  uid: string;
  email: string;
  displayName: string;
  role: 'basic' | 'plus' | 'admin';
  storageLimit: number;
  storageUsed: number;
  createdAt: Date | null;
  lastLogin: Date | null;
};

function isAdminFromToken(decoded: Decoded): boolean {
  const role = decoded?.role;
  return role === 'admin';
}

async function assertAdmin(decoded: Exclude<Decoded, null>): Promise<boolean> {
  if (isAdminFromToken(decoded)) return true;
  const db = getFirestore();
  const snap = await db.doc(`users/${decoded.uid}`).get();
  return snap.exists && snap.get('role') === 'admin';
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Brak tokenu autoryzacji' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = (await verifyToken(token)) as Decoded;
    if (!decoded) return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
    const ok = await assertAdmin(decoded);
    if (!ok) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });

    const db = getFirestore();
    // Fetch all auth users (first 1000). For larger sets, add pagination via nextPageToken
    const auth = getAuth();
    const result: ListUsersResult = await auth.listUsers(1000);

    // Build a map from Firestore user docs to enrich with storage and role
    const usersSnap = await db.collection('users').get();
    const byUid = new Map<string, { [k: string]: unknown }>(
      usersSnap.docs.map((d) => [d.id, d.data()])
    );

    const users: UserRow[] = result.users.map((u: UserRecord) => {
      const extra = byUid.get(u.uid) || {};
      const createdAt = u.metadata?.creationTime ? new Date(u.metadata.creationTime) : null;
      const lastLogin = u.metadata?.lastSignInTime ? new Date(u.metadata.lastSignInTime) : null;
      return {
        uid: u.uid,
        email: u.email || (extra['email'] as string) || '',
        displayName: u.displayName || (extra['displayName'] as string) || (u.email || ''),
        role: (extra['role'] as 'basic' | 'plus' | 'admin') || 'basic',
        storageLimit: (extra['storageLimit'] as number) ?? 5 * 1024 * 1024 * 1024,
        storageUsed: (extra['storageUsed'] as number) ?? 0,
        createdAt,
        lastLogin,
      };
    });
    return NextResponse.json(users);
  } catch (e) {
    console.error('GET /api/admin/users error:', e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Brak tokenu autoryzacji' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = (await verifyToken(token)) as Decoded;
    if (!decoded) return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
    const ok = await assertAdmin(decoded);
    if (!ok) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });

    const body = await request.json();
    const parsed = adminCreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Nieprawidłowe dane', details: parsed.error.flatten() }, { status: 400 });
    }
    const { email, displayName, role = 'basic', storageLimitGb = 5, password } = parsed.data;

    const auth = getAuth();
    const pwd = password && password.length >= 6 ? password : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
    const userRecord = await auth.createUser({ email, displayName, password: pwd, emailVerified: false });

    await auth.setCustomUserClaims(userRecord.uid, { role });

    const db = getFirestore();
    await db.doc(`users/${userRecord.uid}`).set({
      uid: userRecord.uid,
      email,
      displayName: displayName ?? email,
      role,
      storageLimit: Number(storageLimitGb) * 1024 * 1024 * 1024,
      storageUsed: 0,
      createdAt: FieldValue.serverTimestamp(),
      lastLogin: FieldValue.serverTimestamp(),
    }, { merge: true });

    // Audit log
    try {
      await db.collection('activityLogs').add({
        userId: decoded.uid,
        action: 'admin_user_create',
        fileName: undefined,
        fileSize: undefined,
        timestamp: FieldValue.serverTimestamp(),
        targetUserId: userRecord.uid
      });
    } catch {}

    return NextResponse.json({ uid: userRecord.uid });
  } catch (e) {
    console.error('POST /api/admin/users error:', e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return NextResponse.json({ error: 'Brak tokenu autoryzacji' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];
    const decoded = (await verifyToken(token)) as Decoded;
    if (!decoded) return NextResponse.json({ error: 'Nieprawidłowy token' }, { status: 401 });
    const ok = await assertAdmin(decoded);
    if (!ok) return NextResponse.json({ error: 'Brak uprawnień' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    if (!userId) return NextResponse.json({ error: 'Brak ID użytkownika' }, { status: 400 });

    // Sprawdź czy nie próbujemy usunąć samego siebie
    if (userId === decoded.uid) {
      return NextResponse.json({ error: 'Nie możesz usunąć swojego konta' }, { status: 400 });
    }

    const auth = getAuth();
    const db = getFirestore();

    // Usuń użytkownika z Firebase Auth
    await auth.deleteUser(userId);

    // Usuń dane z Firestore
    await db.doc(`users/${userId}`).delete();

    // Usuń pliki użytkownika z R2
    try {
      const userFiles = await listFiles(`users/${userId}/`);
      for (const file of userFiles) {
        if (file && file.Key) {
          await deleteFile(file.Key);
        }
      }
    } catch (error) {
      console.error('Error deleting user files:', error);
      // Kontynuuj nawet jeśli nie udało się usunąć plików
    }

    // Usuń logi aktywności użytkownika
    try {
      const logsQuery = db.collection('activityLogs').where('userId', '==', userId);
      const logsSnapshot = await logsQuery.get();
      const batch = db.batch();
      logsSnapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    } catch (error) {
      console.error('Error deleting user logs:', error);
    }

    // Audit log
    try {
      await db.collection('activityLogs').add({
        userId: decoded.uid,
        action: 'admin_user_delete',
        timestamp: FieldValue.serverTimestamp(),
        targetUserId: userId
      });
    } catch {}

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error('DELETE /api/admin/users error:', e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

