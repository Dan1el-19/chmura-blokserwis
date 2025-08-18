import React, { useState } from 'react';
import { X, Clock, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface ShareOptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (expiresIn?: number, expiresAt?: Date, name?: string) => void;
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

  const handleConfirm = () => {
    if (!linkName.trim()) {
      alert('Proszę podać nazwę linku');
      return;
    }

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
      onConfirm(undefined, dateTime, linkName.trim());
    } else {
      // Konwertuj na sekundy
      const multipliers = {
        minutes: 60,
        hours: 60 * 60,
        days: 24 * 60 * 60,
        months: 30 * 24 * 60 * 60 // przybliżenie
      };
      const expiresIn = timeValue * multipliers[timeUnit];
      onConfirm(expiresIn, undefined, linkName.trim());
    }
    onClose();
  };

  const handleClose = () => {
    // Reset form
    setTimeValue(1);
    setTimeUnit('days');
    setUseCustomDate(false);
    setCustomDate('');
    setCustomTime('');
    setLinkName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Opcje udostępnienia</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="p-2"
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm text-gray-600 mb-2">Plik: <span className="font-medium text-gray-900">{fileName}</span></p>
          </div>

          {/* Nazwa linku */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Nazwa linku:</label>
            <input
              type="text"
              value={linkName}
              onChange={(e) => setLinkName(e.target.value)}
              placeholder="np. Link dla klienta, Link tymczasowy..."
              className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-gray-900 autofill:bg-white autofill:text-black"
              style={{
                WebkitTextFillColor: 'black',
                WebkitBoxShadow: '0 0 0 30px white inset',
                boxShadow: '0 0 0 30px white inset'
              }}
            />
          </div>

          {/* Opcja 1: Czas względny */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="relative-time"
                checked={!useCustomDate}
                onChange={() => setUseCustomDate(false)}
                className="text-gray-900"
              />
              <label htmlFor="relative-time" className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <Clock className="h-4 w-4" />
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
                   className="w-20 px-3 py-2 border border-gray-200 rounded text-sm text-gray-900 autofill:bg-white autofill:text-black"
                   style={{
                     WebkitTextFillColor: 'black',
                     WebkitBoxShadow: '0 0 0 30px white inset',
                     boxShadow: '0 0 0 30px white inset'
                   }}
                 />
                                 <select
                   value={timeUnit}
                   onChange={(e) => setTimeUnit(e.target.value as TimeUnit)}
                   className="px-3 py-2 border border-gray-200 rounded text-sm text-gray-900"
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
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="radio"
                id="custom-date"
                checked={useCustomDate}
                onChange={() => setUseCustomDate(true)}
                className="text-gray-900"
              />
              <label htmlFor="custom-date" className="flex items-center gap-2 text-sm font-medium text-gray-900">
                <Calendar className="h-4 w-4" />
                Link ważny do konkretnej daty
              </label>
            </div>
            
            {useCustomDate && (
              <div className="ml-6 space-y-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Data:</label>
                                     <input
                     type="date"
                     value={customDate}
                     onChange={(e) => setCustomDate(e.target.value)}
                     min={new Date().toISOString().split('T')[0]}
                     className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-gray-900 autofill:bg-white autofill:text-black"
                     style={{
                       WebkitTextFillColor: 'black',
                       WebkitBoxShadow: '0 0 0 30px white inset',
                       boxShadow: '0 0 0 30px white inset'
                     }}
                   />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Godzina:</label>
                                     <input
                     type="time"
                     value={customTime}
                     onChange={(e) => setCustomTime(e.target.value)}
                     className="w-full px-3 py-2 border border-gray-200 rounded text-sm text-gray-900 autofill:bg-white autofill:text-black"
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
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">Link będzie ważny:</p>
            <p className="text-sm font-medium text-gray-900">
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
              className="flex-1"
            >
              Anuluj
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirm}
              className="flex-1"
            >
              Utwórz link
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
