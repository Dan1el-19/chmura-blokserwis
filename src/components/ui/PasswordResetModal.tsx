import React, { useEffect, useState } from 'react';
import { X, Loader2, Mail, KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import toast from 'react-hot-toast';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function PasswordResetModal({ isOpen, onClose }: PasswordResetModalProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setSent(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const emailTrimmed = email.trim();
    
    if (!emailTrimmed) {
      toast.error('Podaj adres email');
      return;
    }

    // Podstawowa walidacja email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(emailTrimmed)) {
      toast.error('Podaj prawidłowy adres email');
      return;
    }

    setLoading(true);

    try {
      // Najpierw sprawdź czy użytkownik istnieje w bazie danych
      const checkResponse = await fetch('/api/auth/check-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailTrimmed })
      });

      if (!checkResponse.ok) {
        let errorMessage = 'Błąd sprawdzania użytkownika';
        
        try {
          const errorData = await checkResponse.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          // Jeśli nie można sparsować JSON, użyj domyślnego komunikatu
        }
        
        if (checkResponse.status === 500) {
          errorMessage = 'Błąd serwera. Spróbuj ponownie później';
        } else if (checkResponse.status === 400) {
          errorMessage = 'Nieprawidłowe dane. Sprawdź adres email';
        }
        
        toast.error(errorMessage);
        return;
      }

      let checkData;
      try {
        checkData = await checkResponse.json();
      } catch {
        toast.error('Błąd odpowiedzi serwera');
        return;
      }

      const { exists } = checkData;
      
      if (!exists) {
        toast.error('Konto z tym adresem email nie istnieje w systemie');
        return;
      }

      // Jeśli użytkownik istnieje, wyślij email resetu hasła
      await sendPasswordResetEmail(auth, emailTrimmed);
      setSent(true);
      toast.success('Link do resetu hasła został wysłany na Twój email');
      
    } catch (error: unknown) {
      console.error('Password reset error:', error);
      
      // Sprawdź czy to błąd sieci
      if (error instanceof TypeError && error.message.includes('fetch')) {
        toast.error('Błąd połączenia z serwerem. Sprawdź połączenie internetowe');
        return;
      }
      
      // Przetłumacz błędy Firebase na polskie komunikaty
      let errorMessage = 'Błąd wysyłania emaila';
      if (error instanceof Error) {
        const code = (error as { code?: string }).code;
        switch (code) {
          case 'auth/invalid-email':
            errorMessage = 'Nieprawidłowy adres email';
            break;
          case 'auth/user-not-found':
            errorMessage = 'Użytkownik o podanym adresie email nie istnieje';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Zbyt wiele prób resetu hasła. Spróbuj ponownie za kilka minut';
            break;
          case 'auth/network-request-failed':
            errorMessage = 'Błąd połączenia z serwerem. Sprawdź połączenie internetowe';
            break;
          case 'auth/operation-not-allowed':
            errorMessage = 'Reset hasła jest obecnie wyłączony';
            break;
          default:
            errorMessage = 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie';
        }
      }
      
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSent(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4" role="dialog" aria-modal="true" aria-label="Reset hasła">
      <Card className="max-w-md w-full">
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900">
            <KeyRound className="h-5 w-5"/>
            Reset hasła
          </h3>
          <Button variant="ghost" size="sm" onClick={handleClose} className="p-2">
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <p className="text-sm text-gray-600 mb-4">
                  Podaj swój adres email, a wyślemy Ci link do resetu hasła.
                </p>
                <Input
                  label={<span className="ml-1">Adres email</span>}
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nazwa@email.com"
                  leftIcon={<Mail className="h-4 w-4" />}
                  required
                  autoComplete="email"
                  autoFocus
                  className="placeholder-gray-400 text-gray-800"
                  style={{ '::placeholder': { color: '#9ca3af' } } as React.CSSProperties & { '::placeholder'?: { color: string } }}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Anuluj
                </Button>
                <Button type="submit" variant="primary" disabled={loading || !email.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2"/>
                      Wysyłanie...
                    </>
                  ) : (
                    'Wyślij link'
                  )}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
                  <Mail className="h-6 w-6 text-green-600" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  Email wysłany!
                </h4>
                <p className="text-sm text-gray-600">
                  Sprawdź swoją skrzynkę email. Jeśli nie widzisz wiadomości, sprawdź folder spam.
                </p>
              </div>
              <div className="flex justify-center">
                <Button variant="primary" onClick={handleClose}>
                  Zamknij
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
