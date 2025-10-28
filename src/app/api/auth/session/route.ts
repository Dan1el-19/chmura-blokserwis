import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    
    if (!token) {
      return NextResponse.json(
        { error: 'Token jest wymagany' },
        { status: 400 }
      );
    }

    // Verify the token first
    const decodedToken = await verifyToken(token);
    if (!decodedToken) {
      return NextResponse.json(
        { error: 'Nieprawidłowy token' },
        { status: 401 }
      );
    }

    // Set the session cookie
    const response = NextResponse.json({ 
      success: true, 
      uid: decodedToken.uid,
      role: decodedToken.role || 'basic'
    });
    
    // Set secure cookie with proper options
    response.cookies.set('__session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 5, // 5 days
      path: '/'
    });

    return response;
  } catch (error) {
    console.error('Session endpoint error:', error);
    return NextResponse.json(
      { error: 'Błąd serwera' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  const response = NextResponse.json({ success: true });
  
  // Clear the session cookie
  response.cookies.set('__session', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  });

  return response;
}