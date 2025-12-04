import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X, Clock, Calendar, Infinity } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { auth } from '@/lib/firebase';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { pl } from 'date-fns/locale';

interface ShareOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (expiresIn?: number, expiresAt?: Date, name?: string, customSlug?: string) => void;
  fileName: string;
}

type TimeUnit = 'minutes' | 'hours' | 'days' | 'months';
type ExpiryMode = 'preset' | 'custom-date' | 'unlimited';


const UNLIMITED_SECONDS = 20 * 365 * 24 * 60 * 60; 
const UNLIMITED_THRESHOLD_YEARS = 15;

const TIME_PRESETS = [
  { label: '1 godz', value: 1, unit: 'hours' as TimeUnit },
  { label: '24 godz', value: 24, unit: 'hours' as TimeUnit },
  { label: '7 dni', value: 7, unit: 'days' as TimeUnit },
  { label: '30 dni', value: 30, unit: 'days' as TimeUnit },
];

export default function ShareOptionsModal({
  isOpen,
  onClose,
  onConfirm,
  fileName
}: ShareOptionsModalProps) {
  const [expiryMode, setExpiryMode] = useState<ExpiryMode>('preset');
  const [selectedPreset, setSelectedPreset] = useState(2); 
  const [timeValue, setTimeValue] = useState(7);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('days');
  const [customDate, setCustomDate] = useState<Date | null>(null);
  const [linkName, setLinkName] = useState('');
  const [customSlug, setCustomSlug] = useState('');
  const [slugError, setSlugError] = useState('');
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const slugCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [dateError, setDateError] = useState('');
  const generateSlugPreview = useCallback((name: string): string => {
    const nameWithoutExt = name.replace(/\.[^/.]+$/, '');
    const cleanName = nameWithoutExt
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    const base = cleanName.slice(0, 12).replace(/-$/, '');
    return `${base ? base + '-' : ''}xxxxxxx`;
  }, []);

  const slugPlaceholder = generateSlugPreview(fileName);

  const validateSlug = (slug: string): boolean => {
    if (!slug) return true;
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
    return true;
  };

  const checkSlugAvailability = useCallback(async (slug: string) => {
    if (!slug.trim()) {
      setSlugAvailable(null);
      setSlugChecking(false);
      setSlugError('');
      return;
    }

    
    if (slug.length > 50 || !/^[a-z0-9-]+$/.test(slug)) {
      setSlugAvailable(null);
      setSlugChecking(false);
      return;
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      if (!token) {
        setSlugAvailable(null);
        setSlugChecking(false);
        return;
      }

      const res = await fetch(`/api/files/share/check?slug=${encodeURIComponent(slug)}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        const data = await res.json();
        setSlugAvailable(data.available);
        if (data.available) {
          setSlugError('');
        } else {
          setSlugError('Ten link jest już zajęty');
        }
      } else {
        setSlugAvailable(null);
        setSlugError('');
      }
    } catch {
      setSlugAvailable(null);
      setSlugError('');
    } finally {
      setSlugChecking(false);
    }
  }, []);

  useEffect(() => {
    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current);
    }

    const trimmedSlug = customSlug.trim();
    if (!trimmedSlug) {
      setSlugAvailable(null);
      setSlugChecking(false);
      setSlugError('');
      return;
    }

    if (trimmedSlug.length > 50 || !/^[a-z0-9-]+$/.test(trimmedSlug)) {
      setSlugAvailable(null);
      setSlugChecking(false);
      return;
    }
    setSlugAvailable(null);
    setSlugError('');
    setSlugChecking(true);
    
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
    const finalLinkName = linkName.trim() || customSlug.trim() || 'Bez nazwy';

    if (!validateSlug(customSlug)) {
      return;
    }

    if (customSlug.trim() && (slugAvailable === false || slugChecking)) {
      if (slugAvailable === false) {
        setSlugError('Ten link jest już zajęty');
      }
      return;
    }

    const slugToUse = customSlug.trim() || undefined;

    if (expiryMode === 'custom-date') {
      if (!customDate) {
        setDateError('Proszę wybrać datę');
        return;
      }
      // Ustaw godzinę na 23:59
      const dateTime = new Date(customDate);
      dateTime.setHours(23, 59, 0, 0);
      if (dateTime <= new Date()) {
        setDateError('Data musi być w przyszłości');
        return;
      }
      setDateError('');
      onConfirm(undefined, dateTime, linkName.trim(), slugToUse);
    } else if (expiryMode === 'unlimited') {
      
      onConfirm(UNLIMITED_SECONDS, undefined, linkName.trim(), slugToUse);
    } else if (expiryMode === 'preset') {
      const preset = TIME_PRESETS[selectedPreset];
      const multipliers = {
        minutes: 60,
        hours: 60 * 60,
        days: 24 * 60 * 60,
        months: 30 * 24 * 60 * 60
      };
      const expiresIn = preset.value * multipliers[preset.unit];
      onConfirm(expiresIn, undefined, linkName.trim(), slugToUse);
    }
    
  };

  const handleClose = () => {
    
    setExpiryMode('preset');
    setSelectedPreset(2);
    setTimeValue(7);
    setTimeUnit('days');
    setCustomDate(null);
    setLinkName('');
    setCustomSlug('');
    setSlugError('');
    setSlugAvailable(null);
    setSlugChecking(false);
    setDateError('');
    if (slugCheckTimeoutRef.current) {
      clearTimeout(slugCheckTimeoutRef.current);
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
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
            <label className="block text-xs sm:text-sm text-gray-900 font-medium mb-1">Nazwa linku:</label>
            <input
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="(Opcjonalne)"
              className="w-full px-2.5 sm:px-3 py-2 border border-gray-200 rounded text-xs sm:text-sm text-gray-900 placeholder:text-gray-400"
            />
          </div>

          {/* Niestandardowy link */}
          <div>
            <label className="block text-xs sm:text-sm text-gray-900 font-medium mb-1">Niestandardowy link (opcjonalnie):</label>
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
                placeholder={slugPlaceholder}
                className="flex-1 px-2.5 sm:px-3 py-2 border border-gray-200 rounded text-xs sm:text-sm text-gray-900 placeholder:text-gray-400"
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

          {/* Ważność linku */}
          <div className="space-y-3">
            <label className="block text-xs sm:text-sm text-gray-900 font-medium">Ważność linku:</label>
            
            {/* Szybkie presety */}
            <div className="flex flex-wrap gap-2">
              {TIME_PRESETS.map((preset, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => {
                    setExpiryMode('preset');
                    setSelectedPreset(index);
                  }}
                  className={`px-3 py-1.5 text-xs sm:text-sm rounded-full border transition-colors ${
                    expiryMode === 'preset' && selectedPreset === index
                      ? 'bg-gray-900 text-white border-gray-900'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                  }`}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setExpiryMode('unlimited')}
                className={`px-3 py-1.5 text-xs sm:text-sm rounded-full border transition-colors flex items-center gap-1 ${
                  expiryMode === 'unlimited'
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                }`}
              >
                <Infinity className="h-3 w-3" />
                Bezterminowo
              </button>
            </div>

            {/* Link do konkretnej daty */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setExpiryMode('custom-date');
                  setDateError('');
                }}
                className={`text-xs sm:text-sm flex items-center gap-1.5 ${
                  expiryMode === 'custom-date' ? 'text-gray-900 font-medium' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <Calendar className="h-3.5 w-3.5" />
                Wybierz konkretną datę
              </button>
            </div>

            {/* Konkretna data */}
            {expiryMode === 'custom-date' && (
              <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={pl}>
                <div className="p-3 bg-gray-50 rounded-lg space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <DatePicker
                      value={customDate}
                      onChange={(newValue) => { setCustomDate(newValue); setDateError(''); }}
                      minDate={new Date()}
                      slotProps={{
                        textField: {
                          size: 'small',
                          sx: {
                            '& .MuiInputBase-root': {
                              backgroundColor: 'white',
                              fontSize: '0.875rem',
                            },
                          },
                        },
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500">Link wygaśnie o 23:59 wybranego dnia</p>
                  {dateError && <p className="text-xs text-red-500">{dateError}</p>}
                </div>
              </LocalizationProvider>
            )}
          </div>

          {/* Podgląd */}
          <div className="bg-gray-50 p-2.5 sm:p-3 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-1">Link będzie ważny:</p>
            <p className="text-xs sm:text-sm font-medium text-gray-900">
              {expiryMode === 'unlimited' ? (
                '♾️ Bezterminowo'
              ) : expiryMode === 'custom-date' ? (
                customDate ? (
                  (() => {
                    const dateTime = new Date(customDate);
                    dateTime.setHours(23, 59, 0, 0);
                    const daysUntil = Math.ceil((dateTime.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    return (
                      <>
                        do {dateTime.toLocaleString('pl-PL')}
                        <span className="text-gray-500 font-normal ml-1">
                          (za {daysUntil} {daysUntil === 1 ? 'dzień' : 'dni'})
                        </span>
                      </>
                    );
                  })()
                ) : (
                  'wybierz datę'
                )
              ) : (
                <>
                  przez {TIME_PRESETS[selectedPreset].value} {
                    TIME_PRESETS[selectedPreset].unit === 'hours' ? 'godzin' : 'dni'
                  }
                  <span className="text-gray-500 font-normal ml-1">
                    (do {new Date(Date.now() + TIME_PRESETS[selectedPreset].value * (TIME_PRESETS[selectedPreset].unit === 'hours' ? 3600000 : 86400000)).toLocaleString('pl-PL')})
                  </span>
                </>
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
