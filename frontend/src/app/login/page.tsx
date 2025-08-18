'use client';

import { useState } from 'react';
import { signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
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
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();

    try {
      await signInWithPopup(auth, provider);
      toast.success('Zalogowano pomyślnie!');
      router.push('/storage');
    } catch (error: unknown) {
      console.error('Google login error:', error);
      
      // Przetłumacz błędy Google na polskie komunikaty
      let errorMessage = 'Błąd logowania przez Google';
      if (error instanceof Error) {
        const code = (error as { code?: string }).code;
        switch (code) {
          case 'auth/popup-closed-by-user':
            errorMessage = 'Okno logowania zostało zamknięte';
            break;
          case 'auth/popup-blocked':
            errorMessage = 'Okno logowania zostało zablokowane przez przeglądarkę';
            break;
          case 'auth/cancelled-popup-request':
            errorMessage = 'Logowanie zostało anulowane';
            break;
          case 'auth/account-exists-with-different-credential':
            errorMessage = 'Konto z tym adresem email już istnieje z inną metodą logowania';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Błąd połączenia z serwerem';
            break;
          default:
            errorMessage = 'Błąd logowania przez Google. Spróbuj ponownie';
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <Link 
            href="/" 
            className="inline-flex items-center text-blue-600 hover:text-blue-700 mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Powrót do strony głównej
          </Link>
          
          <div className="text-center">
            <h2 className="text-3xl font-bold text-gray-900 font-roboto">
              Zaloguj się do chmury
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Dostęp do bezpiecznego przechowywania plików
            </p>
          </div>
        </div>

        <div className="bg-white py-8 px-6 shadow-lg rounded-lg">
          <form className="space-y-6" onSubmit={handleEmailLogin}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Adres email
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-500 autofill:bg-white autofill:text-black autofill:shadow-[0_0_0_30px_white_inset]"
                  placeholder="twoj@email.com"
                  style={{
                    WebkitTextFillColor: 'black',
                    WebkitBoxShadow: '0 0 0 30px white inset',
                    boxShadow: '0 0 0 30px white inset'
                  }}
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Hasło
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black placeholder-gray-500 autofill:bg-white autofill:text-black autofill:shadow-[0_0_0_30px_white_inset]"
                  placeholder="Twoje hasło"
                  style={{
                    WebkitTextFillColor: 'black',
                    WebkitBoxShadow: '0 0 0 30px white inset',
                    boxShadow: '0 0 0 30px white inset'
                  }}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {error && (
                <p className="mt-2 text-sm text-red-600">{error}</p>
              )}
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Logowanie...' : 'Zaloguj się'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-gray-500">Lub</span>
              </div>
            </div>

            <div className="mt-6">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full flex justify-center items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Zaloguj się przez Google
              </button>
            </div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Nie masz jeszcze konta?{' '}
              <span className="font-medium text-blue-600">
                Skontaktuj się z administratorem
              </span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
