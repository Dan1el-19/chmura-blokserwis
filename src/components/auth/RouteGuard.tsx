'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface RouteGuardProps {
  children: React.ReactNode;
  requiredRole?: 'basic' | 'plus' | 'admin';
  fallback?: React.ReactNode;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  role: 'basic' | 'plus' | 'admin';
}

export function RouteGuard({ 
  children, 
  requiredRole,
  fallback = <div className="flex items-center justify-center min-h-screen bg-white">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
  </div>
}: RouteGuardProps) {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    role: 'basic'
  });
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Force token refresh to get latest claims
          const token = await user.getIdToken(true);
          const tokenResult = await user.getIdTokenResult(true);
          
          // Get role from custom claims
          const role = (tokenResult.claims.role as 'basic' | 'plus' | 'admin') || 'basic';
          
          // Ensure session cookie is set for middleware
          try {
            await fetch('/api/auth/session', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ token }),
            });
          } catch (error) {
            console.warn('Failed to set session cookie:', error);
            // Don't fail auth if cookie setting fails
          }
          
          setAuthState({
            user,
            loading: false,
            role
          });
        } catch (error) {
          console.error('Error getting user token:', error);
          // If token is invalid, clear session cookie and sign out
          try {
            await fetch('/api/auth/session', {
              method: 'DELETE',
            });
          } catch (cookieError) {
            console.warn('Failed to clear session cookie:', cookieError);
          }
          
          await auth.signOut();
          setAuthState({
            user: null,
            loading: false,
            role: 'basic'
          });
          router.replace('/login');
        }
      } else {
        setAuthState({
          user: null,
          loading: false,
          role: 'basic'
        });
        
        // Only redirect if we're not already on login page
        if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
          const currentPath = window.location.pathname + window.location.search;
          router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
        }
      }
    });

    return unsubscribe;
  }, [router]);

  // Still loading
  if (authState.loading) {
    return <>{fallback}</>;
  }

  // Not authenticated
  if (!authState.user) {
    return null; // Will redirect in useEffect
  }

  // Check role requirements
  if (requiredRole) {
    const roleHierarchy = { basic: 0, plus: 1, admin: 2 };
    const userLevel = roleHierarchy[authState.role];
    const requiredLevel = roleHierarchy[requiredRole];

    if (userLevel < requiredLevel) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center p-8 bg-red-50 rounded-lg border border-red-200">
            <h2 className="text-xl font-semibold text-red-800 mb-2">
              Brak uprawnień
            </h2>
            <p className="text-red-600">
              Ta strona wymaga uprawnień: <strong>{requiredRole}</strong>
            </p>
            <p className="text-sm text-red-500 mt-2">
              Twoje uprawnienia: <strong>{authState.role}</strong>
            </p>
          </div>
        </div>
      );
    }
  }

  // All checks passed - render children
  return <>{children}</>;
}

// Hook for accessing auth state in components
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    loading: true,
    role: 'basic'
  });

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const tokenResult = await user.getIdTokenResult(true);
          const role = (tokenResult.claims.role as 'basic' | 'plus' | 'admin') || 'basic';
          
          setAuthState({
            user,
            loading: false,
            role
          });
        } catch (error) {
          console.error('Error in useAuth:', error);
          setAuthState({
            user: null,
            loading: false,
            role: 'basic'
          });
        }
      } else {
        setAuthState({
          user: null,
          loading: false,
          role: 'basic'
        });
      }
    });

    return unsubscribe;
  }, []);

  return authState;
}