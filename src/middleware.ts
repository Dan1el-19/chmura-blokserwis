import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Skip middleware for public routes, static files, and API auth endpoints
  if (
    pathname.startsWith('/login') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/manifest.json') ||
    pathname.startsWith('/sw.js') ||
    pathname.startsWith('/offline.html') ||
    pathname.startsWith('/icons/') ||
    pathname === '/'
  ) {
    return NextResponse.next();
  }

  // For critical routes that require server-side token verification
  const criticalRoutes = [
    '/admin-panel',
    '/api/admin',
    '/api/files',
    '/api/folders',
    '/api/user'
  ];

  const isCriticalRoute = criticalRoutes.some(route => pathname.startsWith(route));

  if (isCriticalRoute) {
    // Get the session token from cookies or Authorization header
    const sessionToken = request.cookies.get('__session')?.value || 
                        request.headers.get('authorization')?.replace('Bearer ', '');

    if (!sessionToken) {
      console.log('🚨 Middleware: No session token found for critical route:', pathname);
      
      // For API routes, return JSON error
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Brak autoryzacji' },
          { status: 401 }
        );
      }
      
      // For page routes, redirect to login
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Verify token server-side for critical routes
    try {
      const response = await fetch(`${request.nextUrl.origin}/api/auth/verify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${sessionToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.log('🚨 Middleware: Token verification failed for critical route:', pathname);
        
        if (pathname.startsWith('/api/')) {
          return NextResponse.json(
            { error: 'Token nieprawidłowy' },
            { status: 401 }
          );
        }
        
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('redirect', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Add user info to request headers for API routes
      const userData = await response.json();
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set('x-user-id', userData.uid);
      requestHeaders.set('x-user-role', userData.role || 'basic');
      
      return NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });
    } catch (error) {
      console.error('🚨 Middleware: Error verifying token for critical route:', error);
      
      if (pathname.startsWith('/api/')) {
        return NextResponse.json(
          { error: 'Błąd weryfikacji' },
          { status: 500 }
        );
      }
      
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // For non-critical protected routes (like /storage), rely on client-side RouteGuard
  // This allows the client to handle Firebase Auth properly
  console.log('✅ Middleware: Allowing access to non-critical route:', pathname);
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next (Next.js internals)
     * - favicon.ico (favicon file)
     * - manifest.json (PWA manifest)  
     * - sw.js (service worker)
     * - icons/ (icon files)
     * - offline.html (offline page)
     */
    '/((?!_next|favicon.ico|manifest.json|sw.js|icons/|offline.html).*)',
  ],
};

