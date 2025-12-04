import React, { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import Button from "@/components/ui/Button";

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
  expiresAt,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = shareUrl;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <Card className="w-full sm:max-w-md rounded-t-2xl sm:rounded-xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">
            Link udostępniony
          </h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="no-min-touch p-1.5 sm:p-2"
          >
            <X className="h-4 w-4 sm:h-5 sm:w-5" />
          </Button>
        </CardHeader>

        <CardContent className="space-y-3 sm:space-y-4 pb-safe">
          <div>
            <p className="text-xs sm:text-sm text-gray-600 mb-2">
              Plik:{" "}
              <span className="font-medium text-gray-900 break-all">
                {fileName}
              </span>
            </p>
            {expiresAt && (
              <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                Link ważny:{" "}
                <span className="font-medium text-gray-900">
                  {(() => {
                    const expiryDate = new Date(expiresAt);
                    const yearsFromNow =
                      (expiryDate.getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24 * 365);
                    if (yearsFromNow > 15) {
                      return "♾️ Bezterminowo";
                    }
                    return `do ${expiryDate.toLocaleString("pl-PL")}`;
                  })()}
                </span>
              </p>
            )}
          </div>

          <div className="bg-gray-50 p-2.5 sm:p-3 rounded-lg">
            <p className="text-xs sm:text-sm text-gray-600 mb-2">
              Link do udostępnienia:
            </p>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={shareUrl}
                readOnly
                className="flex-1 text-xs sm:text-sm bg-white border border-gray-200 rounded px-2.5 sm:px-3 py-2 text-gray-900 truncate"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopy}
                className="shrink-0 text-xs sm:text-sm"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                    Skopiowano
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
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
              className="flex-1 text-xs sm:text-sm py-2.5 sm:py-2"
            >
              Zamknij
            </Button>
            <Button
              variant="primary"
              onClick={handleCopy}
              className="flex-1 text-xs sm:text-sm py-2.5 sm:py-2"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
                  Skopiowano
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
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
