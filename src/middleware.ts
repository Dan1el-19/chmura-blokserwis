import { NextResponse } from 'next/server';

export function middleware() {
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/storage/:path*',
    '/admin-panel/:path*',
    '/api/admin/:path*'
  ],
};

