import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Brak tokenu autoryzacji' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await verifyToken(token);
    
    if (!decodedToken) {
      return NextResponse.json(
        { error: 'Nieprawidłowy token' },
        { status: 401 }
      );
    }

    // Check token freshness (max 1 hour old)
    const issuedAt = typeof decodedToken.iat === 'number' ? decodedToken.iat : 0;
    const tokenAge = Date.now() - issuedAt * 1000;
    if (tokenAge > 3600000) { // 1 hour in milliseconds
      return NextResponse.json(
        { error: 'Token wygasł' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      uid: decodedToken.uid,
      email: decodedToken.email,
      role: decodedToken.role || 'basic',
      valid: true
    });
  } catch (error) {
    console.error('Error in auth verify API:', error);
    return NextResponse.json(
      { error: 'Błąd weryfikacji tokenu' },
      { status: 500 }
    );
  }
}