import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, verifyTokenStrict, type DecodedIdToken } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rateLimit';
import { logSecurityEvent } from '@/lib/securityLogger';

export interface SecurityOptions {
  allowAnonymous?: boolean;
  requiredRole?: 'basic' | 'plus' | 'admin';
  strictTokenValidation?: boolean;
  skipRateLimit?: boolean;
  maxTokenAge?: number; // in seconds
}

export interface SecureRequest extends NextRequest {
  user?: DecodedIdToken;
}

type SecureHandler = (request: SecureRequest, user?: DecodedIdToken) => Promise<NextResponse>;

export function withSecurity(
  handler: SecureHandler,
  options: SecurityOptions = {}
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const startTime = Date.now();
    let user: DecodedIdToken | undefined;
    
    try {
      // 1. Rate Limiting Check
      if (!options.skipRateLimit) {
        const rateLimitResult = checkRateLimit(
          request, 
          request.nextUrl.pathname,
          100, // requests per window
          60000 // 1 minute window
        );
        if (!rateLimitResult.ok) {
          await logSecurityEvent.rateLimitExceeded(request);
          return NextResponse.json(
            { 
              error: 'Za dużo żądań. Spróbuj ponownie później.',
              retryAfter: rateLimitResult.retryAfter
            },
            { status: 429 }
          );
        }
      }

      // 2. Authentication Check
      if (!options.allowAnonymous) {
        const authHeader = request.headers.get('authorization');
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          await logSecurityEvent.unauthorizedAccess(request, undefined, {
            reason: 'Missing authorization header',
            endpoint: request.nextUrl.pathname
          });
          
          return NextResponse.json(
            { error: 'Brak tokenu autoryzacji' },
            { status: 401 }
          );
        }

        const token = authHeader.split('Bearer ')[1];
        
        // Choose verification method based on options
        if (options.strictTokenValidation) {
          const verifiedUser = await verifyTokenStrict(token, options.maxTokenAge);
          user = verifiedUser || undefined;
        } else {
          const verifiedUser = await verifyToken(token);
          user = verifiedUser || undefined;
        }

        if (!user) {
          await logSecurityEvent.unauthorizedAccess(request, undefined, {
            reason: 'Invalid token',
            endpoint: request.nextUrl.pathname
          });
          
          return NextResponse.json(
            { error: 'Nieprawidłowy lub wygasły token' },
            { status: 401 }
          );
        }

        // 3. Role Authorization Check
        if (options.requiredRole) {
          const roleHierarchy = { basic: 0, plus: 1, admin: 2 };
          const userLevel = roleHierarchy[user.role || 'basic'];
          const requiredLevel = roleHierarchy[options.requiredRole];

          if (userLevel < requiredLevel) {
            await logSecurityEvent.unauthorizedAccess(request, user.uid, {
              reason: 'Insufficient role',
              userRole: user.role,
              requiredRole: options.requiredRole,
              endpoint: request.nextUrl.pathname
            });
            
            return NextResponse.json(
              { 
                error: 'Brak uprawnień do tego zasobu',
                required: options.requiredRole,
                current: user.role || 'basic'
              },
              { status: 403 }
            );
          }
        }
      }

      // 4. Input Sanitization (basic)
      const sanitizedRequest = await sanitizeRequest(request);

      // 5. Call the actual handler
      const response = await handler(sanitizedRequest as SecureRequest, user);

      // 6. Log successful API access
      const duration = Date.now() - startTime;
      if (user) {
        console.log(`✅ API Success: ${request.method} ${request.nextUrl.pathname} - User: ${user.uid} - ${duration}ms`);
      }

      return response;

    } catch (error: unknown) {
      // 7. Error Handling & Logging
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      await logSecurityEvent.apiError(request, error, user?.uid);
      
      console.error('🚨 API Security Error:', {
        endpoint: request.nextUrl.pathname,
        method: request.method,
        user: user?.uid,
        error: errorMessage,
        stack: errorStack
      });

      // Don't leak internal error details in production
      const isDevelopment = process.env.NODE_ENV === 'development';
      
      return NextResponse.json(
        { 
          error: 'Błąd serwera',
          ...(isDevelopment && { details: errorMessage, stack: errorStack })
        },
        { status: 500 }
      );
    }
  };
}

// Input sanitization helper
async function sanitizeRequest(request: NextRequest): Promise<NextRequest> {
  // Basic sanitization - can be expanded based on needs
  const sanitizedHeaders = new Headers(request.headers);
  
  // Remove potentially dangerous headers
  sanitizedHeaders.delete('x-forwarded-host');
  sanitizedHeaders.delete('x-forwarded-proto');
  
  // Validate Content-Type for POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
    const contentType = request.headers.get('content-type');
    if (contentType && !isValidContentType(contentType)) {
      throw new Error('Invalid content type');
    }
  }
  
  // Create new request with sanitized headers
  return new NextRequest(request.url, {
    method: request.method,
    headers: sanitizedHeaders,
    body: request.body,
  });
}

function isValidContentType(contentType: string): boolean {
  const validTypes = [
    'application/json',
    'application/x-www-form-urlencoded',
    'multipart/form-data',
    'text/plain'
  ];
  
  return validTypes.some(type => contentType.toLowerCase().includes(type));
}

// Convenience wrapper for admin-only endpoints
export function withAdminSecurity(handler: SecureHandler) {
  return withSecurity(handler, {
    requiredRole: 'admin',
    strictTokenValidation: true,
    maxTokenAge: 1800 // 30 minutes for admin actions
  });
}

// Convenience wrapper for plus/admin endpoints
export function withPremiumSecurity(handler: SecureHandler) {
  return withSecurity(handler, {
    requiredRole: 'plus',
    strictTokenValidation: true
  });
}

// Convenience wrapper for basic authenticated endpoints
export function withAuthSecurity(handler: SecureHandler) {
  return withSecurity(handler, {
    requiredRole: 'basic'
  });
}