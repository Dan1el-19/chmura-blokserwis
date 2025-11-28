"use client";

import { useEffect, useRef, useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import { Mail, Lock, Eye, EyeOff, Cloud } from 'lucide-react';
import { use100vh } from '@/hooks/use100vh';
import toast from 'react-hot-toast';
import { Card, CardContent } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import PasswordResetModal from '@/components/ui/PasswordResetModal';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // Oddzielne stany ładowania dla email i Google, by nie blokować UI po anulowaniu popupu
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingGoogle, setLoadingGoogle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const router = useRouter();
  // Fix 100vh na mobilnych przeglądarkach (eliminuje biały pasek na dole)
  use100vh();

  // Ref do śledzenia stanu trwającego flow Google oraz zarejestrowanych listenerów
  const googleFlowRef = useRef<{ active: boolean; completed: boolean }>({ active: false, completed: false });
  const listenersRef = useRef<{ onFocus?: () => void; onVisibility?: () => void } | null>(null);

  // Cleanup listenerów na odmontowanie komponentu (na wszelki wypadek)
  useEffect(() => {
    return () => {
      if (listenersRef.current?.onFocus) {
        window.removeEventListener('focus', listenersRef.current.onFocus);
      }
      if (listenersRef.current?.onVisibility) {
        document.removeEventListener('visibilitychange', listenersRef.current.onVisibility);
      }
      listenersRef.current = null;
      googleFlowRef.current.active = false;
    };
  }, []);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingEmail(true);
    setError(null);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success('Zalogowano pomyślnie!');
      router.push('/storage');
    } catch (error: unknown) {
      console.error('Login error:', error);

      // Przetłumacz błędy Firebase na polskie komunikaty
      let errorMessage = 'Błąd logowania';
      if (error instanceof Error) {
        const code = (error as { code?: string }).code;
        switch (code) {
          case 'auth/user-not-found':
            errorMessage = 'Użytkownik o podanym adresie email nie istnieje';
            break;
          case 'auth/wrong-password':
            errorMessage = 'Nieprawidłowe hasło';
            break;
          case 'auth/invalid-email':
            errorMessage = 'Nieprawidłowy adres email';
            break;
          case 'auth/user-disabled':
            errorMessage = 'Konto zostało wyłączone';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Zbyt wiele prób logowania. Spróbuj ponownie później';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Błąd połączenia z serwerem';
            break;
          default:
            errorMessage = 'Błąd logowania. Sprawdź dane i spróbuj ponownie';
        }
      }

      setError(errorMessage);
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleGoogleLogin = () => {
    setLoadingGoogle(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    // Zaznacz start flow Google
    googleFlowRef.current = { active: true, completed: false };

    // Funkcja do czyszczenia listenerów
    const detach = () => {
      if (listenersRef.current?.onFocus) {
        window.removeEventListener('focus', listenersRef.current.onFocus);
      }
      if (listenersRef.current?.onVisibility) {
        document.removeEventListener('visibilitychange', listenersRef.current.onVisibility);
      }
      listenersRef.current = null;
    };

    // Gdy okno wróci na pierwszy plan po zamknięciu popupu, natychmiast wyłącz loader
    const onFocus = () => {
      const { active, completed } = googleFlowRef.current;
      if (!active || completed) return;
      // Jeśli nie doszło do zalogowania, traktuj jako anulowanie (COOP potrafi opóźniać błędy SDK)
      if (!auth.currentUser) {
        setLoadingGoogle(false);
        setError(null);
        try { toast('Anulowano logowanie przez Google'); } catch {}
        googleFlowRef.current.active = false;
        detach();
      }
    };
    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };

    // Zarejestruj listenery natychmiast po kliknięciu
    listenersRef.current = { onFocus, onVisibility };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);

    // Uruchom popup bez await – obsłuż obietnicę ręcznie, by nie blokować UI
    signInWithPopup(auth, provider)
      .then(() => {
        googleFlowRef.current.completed = true;
        googleFlowRef.current.active = false;
        detach();
        try { toast.success('Zalogowano pomyślnie!'); } catch {}
        router.push('/storage');
      })
      .catch((error: unknown) => {
        console.error('Google login error:', error);
        const code: string | undefined = (error as { code?: string } | undefined)?.code;
        // Jeśli już wyłączyliśmy loader poprzez onFocus, zignoruj “popup closed”
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
          detach();
          googleFlowRef.current.active = false;
          setLoadingGoogle(false);
          return;
        }

        // Inne błędy – pokaż komunikat
        let errorMessage = 'Błąd logowania przez Google';
        switch (code) {
          case 'auth/popup-blocked':
            errorMessage = 'Okno logowania zostało zablokowane przez przeglądarkę';
            break;
          case 'auth/account-exists-with-different-credential':
            errorMessage = 'Konto z tym adresem email już istnieje z inną metodą logowania';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Błąd połączenia z serwerem';
            break;
          case 'auth/operation-not-supported-in-this-environment':
            errorMessage = 'Ta metoda logowania nie jest wspierana w tej przeglądarce/środowisku';
            break;
          default:
            errorMessage = 'Błąd logowania przez Google. Spróbuj ponownie';
        }
        setError(errorMessage);
      })
      .finally(() => {
        setLoadingGoogle(false);
        detach();
        googleFlowRef.current.active = false;
      });
  };

  return (
    <div className="h-app-screen w-full bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center py-6 sm:py-12 px-3 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-20 sm:-top-40 -right-20 sm:-right-40 w-40 sm:w-80 h-40 sm:h-80 bg-blue-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-20 sm:-bottom-40 -left-20 sm:-left-40 w-40 sm:w-80 h-40 sm:h-80 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-20 sm:top-40 left-20 sm:left-40 w-40 sm:w-80 h-40 sm:h-80 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative max-w-md w-full space-y-6 sm:space-y-8">
  {/* Usunięto przycisk powrotu na stronę główną (root przekierowuje do /login) */}

        {/* Header */}
        <div className="text-center space-y-3 sm:space-y-4">
          <div className="flex justify-center">
            <div className="p-2.5 sm:p-3 bg-blue-100 rounded-full">
              <Cloud className="h-6 w-6 sm:h-8 sm:w-8 text-blue-600" />
            </div>
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 font-roboto">
              Witaj w Chmurze
            </h1>
            <p className="mt-1.5 sm:mt-2 text-sm sm:text-base text-gray-600">
              Zaloguj się
            </p>
          </div>
        </div>

        {/* Login Card */}
        <Card className="shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-4 sm:p-6 md:p-8">
            <form className="space-y-6" onSubmit={handleEmailLogin}>
              <Input
              label={<span className="ml-1">Adres email</span>}
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nazwa@email.com"
              leftIcon={<Mail className="h-4 w-4" />}
              required
              autoComplete="email"
              className="placeholder-gray-400 text-gray-800 -mb-2"
              style={{ '::placeholder': { color: '#9ca3af' } } as React.CSSProperties & { '::placeholder'?: { color: string } }}
              />

              {/* Password Input */}
              <div>
              <Input
                label={<span className="ml-1">Hasło</span>}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                }
                required
                autoComplete="current-password"
              />
              <div className="mt-2 -mb-3 text-left">
                <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="text-sm text-blue-600 hover:text-blue-700 transition-colors ml-1"
                >
                Zapomniałeś hasła?
                </button>
              </div>
              </div>

              {/* Error Message */}
              {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
              )}

              {/* Login Button */}
              <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={loadingEmail}
              className="w-full"
              disabled={loadingEmail || loadingGoogle}
              >
              {loadingEmail ? 'Logowanie...' : 'Zaloguj się'}
              </Button>
            </form>

            {/* Divider */}
            <div className="relative my-6"> {/* Zmniejszono odległość na osi Y */}
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-4 bg-white text-gray-500 font-medium">lub</span>
              </div>
            </div>

            {/* Google Login Button */}
            <Button
              variant="outline"
              size="lg"
              onClick={handleGoogleLogin}
              loading={loadingGoogle}
              disabled={loadingEmail || loadingGoogle}
              className="w-full"
            >
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Zaloguj się przez Google
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Password Reset Modal */}
      <PasswordResetModal 
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
      />

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}
