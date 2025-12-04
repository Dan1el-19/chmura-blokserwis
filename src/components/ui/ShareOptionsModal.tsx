import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Clock, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { auth } from '@/lib/firebase';

interface ShareOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (expiresIn?: number, expiresAt?: Date, name?: string, customSlug?: string) => void;
  fileName: string;
}

type TimeUnit = 'minutes' | 'hours' | 'days' | 'months';

export default function ShareOptionsModal({
  isOpen,
  onClose,
  onConfirm,
  fileName
}: ShareOptionsModalProps) {
  const [timeValue, setTimeValue] = useState(1);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('days');
  const [useCustomDate, setUseCustomDate] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const [customTime, setCustomTime] = useState('');
  const [linkName, setLinkName] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [slugError, setSlugError] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const slugCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const validateSlug = (slug: string): boolean => {
    if (!slug) return true; // pusty jest OK (użyje automatycznego)
    if (slug.length > 50) {
      setSlugError('Maksymalnie 50 znaków');
      setSlugAvailable(null);
      return false;
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      setSlugError('Tylko małe litery, cyfry i myślniki');
      setSlugAvailable(null);
      return false;
    }
    // Nie czyść błędu tutaj - błąd zajętości ustawia checkSlugAvailability
    return true;
  };

  // Sprawdzanie dostępności slug-a w Firestore (debounced)
  const checkSlugAvailability = useCallback(async (slug: string) => {
    console.log('[SlugCheck] Starting check for:', slug);
    
    if (!slug.trim()) {
      console.log('[SlugCheck] Empty slug, skipping');
      setSlugAvailable(null);
      setSlugChecking(false);
      setSlugError('');
      return;
    }

    // Nie sprawdzaj jeśli format nieprawidłowy
    if (slug.length > 50 || !/^[a-z0-9-]+$/.test(slug)) {
      console.log('[SlugCheck] Invalid format, skipping');
      setSlugAvailable(null);
      setSlugChecking(false);
      return;
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      console.log('[SlugCheck] Token exists:', !!token);
      if (!token) {
        console.log('[SlugCheck] No token, user not logged in');
        setSlugAvailable(null);
        setSlugChecking(false);
        return;
      }

      console.log('[SlugCheck] Fetching...');
      const res = await fetch(`/api/files/share/check?slug=${encodeURIComponent(slug)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      console.log('[SlugCheck] Response status:', res.status);
      
      if (res.ok) {
        const data = await res.json();
        console.log('[SlugCheck] Response data:', data);
        setSlugAvailable(data.available);
        if (data.available) {
          setSlugError(''); // Czyść błąd tylko gdy dostępny
        } else {
          setSlugError('Ten link jest już zajęty');
        }
      } else {
        console.log('[SlugCheck] Response not OK');
        setSlugAvailable(null);
        setSlugError('');
      }
    } catch (err) {
      console.error('[SlugCheck] Error:', err);
      setSlugAvailable(null);
      setSlugError('');
    } finally {
      console.log('[SlugCheck] Finally, setting slugChecking to false');
      setSlugChecking(false);
    }
  }, []);

  // Debounced sprawdzanie przy zmianie customSlug
  useEffect(() => {
    // Wyczyść poprzedni timeout
    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current);
    }

    const trimmedSlug = customSlug.trim();
    
    // Jeśli pusty, resetuj wszystko
    if (!trimmedSlug) {
      setSlugAvailable(null);
      setSlugChecking(false);
      setSlugError('');
      return;
    }

    // Sprawdź format - jeśli zły, nie sprawdzaj API
    if (trimmedSlug.length > 50 || !/^[a-z0-9-]+$/.test(trimmedSlug)) {
      setSlugAvailable(null);
      setSlugChecking(false);
      return;
    }

    // Resetuj stan przed sprawdzeniem
    setSlugAvailable(null);
    setSlugError('');
    setSlugChecking(true);
    
    // Ustaw nowy timeout (debounce 400ms)
    slugCheckTimeoutRef.current = setTimeout(() => {
      checkSlugAvailability(trimmedSlug);
    }, 400);

    return () => {
      if (slugCheckTimeoutRef.current) {
        clearTimeout(slugCheckTimeoutRef.current);
      }
    };
  }, [customSlug, checkSlugAvailability]);

  const handleConfirm = () => {
    // Użyj customSlug jako nazwy linku jeśli nazwa nie podana
    const finalLinkName = linkName.trim() || customSlug.trim() || 'Bez nazwy';

    if (!validateSlug(customSlug)) {
      return;
    }

    // Zablokuj jeśli slug jest zajęty lub jeszcze sprawdzany
    if (customSlug.trim() && (slugAvailable === false || slugChecking)) {
      if (slugAvailable === false) {
        setSlugError('Ten link jest już zajęty');
      }
      return;
    }

    const slugToUse = customSlug.trim() || undefined;

    if (useCustomDate) {
      if (!customDate || !customTime) {
        alert('Proszę wybrać datę i godzinę');
        return;
      }
      const dateTime = new Date(`${customDate}T${customTime}`);
      if (dateTime <= new Date()) {
        alert('Data musi być w przyszłości');
        return;
      }
      onConfirm(undefined, dateTime, linkName.trim(), slugToUse);
    } else {
      // Konwertuj na sekundy
      const multipliers = {
        minutes: 60,
        hours: 60 * 60,
        days: 24 * 60 * 60,
        months: 30 * 24 * 60 * 60 // przybliżenie
      };
      const expiresIn = timeValue * multipliers[timeUnit];
      onConfirm(expiresIn, undefined, linkName.trim(), slugToUse);
    }
    // Nie zamykaj modalu tutaj - rodzic zamknie po obsłużeniu odpowiedzi API
  };

  const handleClose = () => {
    // Reset form
    setTimeValue(1);
    setTimeUnit('days');
    setUseCustomDate(false);
    setCustomDate('');
    setCustomTime('');
    setLinkName('');
    setCustomSlug('');
    setSlugError('');
    setSlugAvailable(null);
    setSlugChecking(false);
    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <Card className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">Opcje udostępnienia</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="no-min-touch p-1.5 sm:p-2"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4 sm:space-y-6 pb-safe">
          <div>
            <p className="text-xs sm:text-sm text-gray-600 mb-2">Plik: <span className="font-medium text-gray-900 break-all">{fileName}</span></p>
          </div>

          {/* Nazwa linku */}
          <div>
            <label className="block text-xs sm:text-sm text-gray-600 mb-1">Nazwa linku:</label>
            <input
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="np. Link dla klienta, Link tymczasowy..."
              className="w-full px-2.5 sm:px-3 py-2 border border-gray-200 rounded text-xs sm:text-sm text-gray-900 autofill:bg-white autofill:text-black"
              style={{
                WebkitTextFillColor: 'black',
                WebkitBoxShadow: '0 0 0 30px white inset',
                boxShadow: '0 0 0 30px white inset'
              }}
            />
          </div>

          {/* Niestandardowy link */}
          <div>
            <label className="block text-xs sm:text-sm text-gray-600 mb-1">Niestandardowy link (opcjonalnie):</label>
            <div className="flex items-center gap-1">
              <span className="text-xs sm:text-sm text-gray-500 shrink-0">/files/</span>
              <input
                type="text"
                value={customSlug}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase();
                  setCustomSlug(val);
                  validateSlug(val);
                }}
                placeholder="np. p1, faktura-2024..."
                className="flex-1 px-2.5 sm:px-3 py-2 border border-gray-200 rounded text-xs sm:text-sm text-gray-900 autofill:bg-white autofill:text-black"
                style={{
                  WebkitTextFillColor: 'black',
                  WebkitBoxShadow: '0 0 0 30px white inset',
                  boxShadow: '0 0 0 30px white inset'
                }}
              />
            </div>
            {slugError && <p className="text-xs text-red-500 mt-1">{slugError}</p>}
            {slugChecking && !slugError && (
              <p className="text-xs text-gray-500 mt-1">Sprawdzanie dostępności...</p>
            )}
            {slugAvailable === true && !slugError && !slugChecking && customSlug.trim() && (
              <p className="text-xs text-green-600 mt-1">✓ Link dostępny</p>
            )}
            {!customSlug.trim() && !slugError && (
              <p className="text-xs text-gray-500 mt-1">Zostaw puste, aby wygenerować automatycznie</p>
            )}
          </div>

          {/* Opcja 1: Czas względny */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="relative-time"
                checked={!useCustomDate}
                onChange={() => setUseCustomDate(false)}
                className="text-gray-900"
              />
              <label htmlFor="relative-time" className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-900">
                <Clock className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Link ważny przez
              </label>
            </div>
            
            {!useCustomDate && (
              <div className="ml-6 flex items-center gap-2">
                                 <input
                   type="number"
                   min="1"
                   value={timeValue}
                   onChange={(e) => setTimeValue(parseInt(e.target.value) || 1)}
                   className="w-16 sm:w-20 px-2 sm:px-3 py-2 border border-gray-200 rounded text-xs sm:text-sm text-gray-900 autofill:bg-white autofill:text-black"
                   style={{
                     WebkitTextFillColor: 'black',
                     WebkitBoxShadow: '0 0 0 30px white inset',
                     boxShadow: '0 0 0 30px white inset'
                   }}
                 />
                                 <select
                   value={timeUnit}
                   onChange={(e) => setTimeUnit(e.target.value as TimeUnit)}
                   className="px-2 sm:px-3 py-2 border border-gray-200 rounded text-xs sm:text-sm text-gray-900"
                 >
                  <option value="minutes">minut</option>
                  <option value="hours">godzin</option>
                  <option value="days">dni</option>
                  <option value="months">miesięcy</option>
                </select>
              </div>
            )}
          </div>

          {/* Opcja 2: Konkretna data */}
          <div className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="custom-date"
                checked={useCustomDate}
                onChange={() => setUseCustomDate(true)}
                className="text-gray-900"
              />
              <label htmlFor="custom-date" className="flex items-center gap-2 text-xs sm:text-sm font-medium text-gray-900">
                <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                Link ważny do konkretnej daty
              </label>
            </div>
            
            {useCustomDate && (
              <div className="ml-6 space-y-2 sm:space-y-3">
                <div>
                  <label className="block text-xs sm:text-sm text-gray-600 mb-1">Data:</label>
                                     <input
                     type="date"
                     value={customDate}
                     onChange={(e) => setCustomDate(e.target.value)}
                     min={new Date().toISOString().split('T')[0]}
                     className="w-full px-2.5 sm:px-3 py-2 border border-gray-200 rounded text-xs sm:text-sm text-gray-900 autofill:bg-white autofill:text-black"
                     style={{
                       WebkitTextFillColor: 'black',
                       WebkitBoxShadow: '0 0 0 30px white inset',
                       boxShadow: '0 0 0 30px white inset'
                     }}
                   />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm text-gray-600 mb-1">Godzina:</label>
                                     <input
                     type="time"
                     value={customTime}
                     onChange={(e) => setCustomTime(e.target.value)}
                     className="w-full px-2.5 sm:px-3 py-2 border border-gray-200 rounded text-xs sm:text-sm text-gray-900 autofill:bg-white autofill:text-black"
                     style={{
                       WebkitTextFillColor: 'black',
                       WebkitBoxShadow: '0 0 0 30px white inset',
                       boxShadow: '0 0 0 30px white inset'
                     }}
                   />
                </div>
              </div>
            )}
          </div>

          {/* Podgląd */}
          <div className="bg-gray-50 p-2.5 sm:p-3 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Link będzie ważny:</p>
            <p className="text-xs sm:text-sm font-medium text-gray-900">
              {useCustomDate ? (
                customDate && customTime ? (
                  `do ${new Date(`${customDate}T${customTime}`).toLocaleString('pl-PL')}`
                ) : (
                  'wybierz datę i godzinę'
                )
              ) : (
                `przez ${timeValue} ${timeUnit === 'minutes' ? 'minut' : 
                  timeUnit === 'hours' ? 'godzin' : 
                  timeUnit === 'days' ? 'dni' : 'miesięcy'}`
              )}
            </p>
          </div>

          {/* Przyciski */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1 text-xs sm:text-sm py-2.5 sm:py-2"
            >
              Anuluj
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              disabled={slugChecking || (customSlug.trim() !== '' && slugAvailable === false)}
              className="flex-1 text-xs sm:text-sm py-2.5 sm:py-2"
            >
              {slugChecking ? 'Sprawdzanie...' : 'Utwórz link'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
