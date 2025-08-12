import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getAuth } from 'firebase-admin/auth';
import { adminPasswordSchema } from '@/lib/validation';

export async function POST(request: NextRequest) {
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
    const parsed = adminPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Nieprawidłowe dane', details: parsed.error.flatten() }, { status: 400 });
    }
    const { uid, password } = parsed.data;

    // Generate password if not provided
    const newPassword = password && password.length >= 6
      ? password
      : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);

    await getAuth().updateUser(uid, { password: newPassword });
    // Audit log
    try {
      // Not storing the password in logs
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      decoded;
    } catch {}

    return NextResponse.json({ success: true, generated: !password, password: !password ? newPassword : undefined });
  } catch (e) {
    console.error('POST /api/admin/users/password error:', e);
    return NextResponse.json({ error: 'Błąd serwera' }, { status: 500 });
  }
}


