import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth, ListUsersResult, UserRecord } from 'firebase-admin/auth';

type Decoded = { uid: string; email?: string; role?: 'basic' | 'plus' | 'admin' } | null;

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

    const body = await request.json() as { email: string; displayName?: string; role?: 'basic' | 'plus' | 'admin'; storageLimitGb?: number; password?: string };
    const { email, displayName, role = 'basic', storageLimitGb = 5, password } = body;
    if (!email) return NextResponse.json({ error: 'Brak email' }, { status: 400 });

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

    return NextResponse.json({ uid: userRecord.uid });
  } catch (e) {
    console.error('POST /api/admin/users error:', e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}

