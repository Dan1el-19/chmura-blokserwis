import React, { useState } from 'react';
import { X, Copy, Check } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import Button from '@/components/ui/Button';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  shareUrl: string;
  fileName: string;
  expiresAt?: string;
}

export default function ShareModal({
  isOpen,
  onClose,
  shareUrl,
  fileName,
  expiresAt
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback dla przeglądarek bez Clipboard API
      const textArea = document.createElement('textarea');
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Link udostępniony</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-2"
          >
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-600 mb-2">Plik: <span className="font-medium text-gray-900">{fileName}</span></p>
            {expiresAt && (
              <p className="text-sm text-gray-600 mb-4">
                Link ważny do: <span className="font-medium text-gray-900">{new Date(expiresAt).toLocaleString('pl-PL')}</span>
              </p>
            )}
          </div>

          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-sm text-gray-600 mb-2">Link do udostępnienia:</p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 text-sm bg-white border border-gray-200 rounded px-3 py-2 text-gray-900"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="flex-shrink-0"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Skopiowano
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4 mr-2" />
                    Kopiuj
                  </>
                )}
              </Button>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
            >
              Zamknij
            </Button>
            <Button
              variant="primary"
              onClick={handleCopy}
              className="flex-1"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Skopiowano
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Kopiuj link
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
