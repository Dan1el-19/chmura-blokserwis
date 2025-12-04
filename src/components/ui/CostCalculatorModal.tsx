"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Calculator, Info, Upload, AlertCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import { CostCalculationResult, Currency } from "@/types";
import {
  calculateStorageCost,
  formatFileSize,
  formatCost,
  fetchSystemStats,
} from "@/lib/costCalculator";

interface CostCalculatorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  file: File | null;
}

export default function CostCalculatorModal({
  isOpen,
  onClose,
  onConfirm,
  file,
}: CostCalculatorModalProps) {
  const [storageDays, setStorageDays] = useState(30);
  const [isIndefinite, setIsIndefinite] = useState(false);
  const [currency, setCurrency] = useState<Currency>("PLN");
  const [systemStats, setSystemStats] = useState<{ totalStorage: number }>({
    totalStorage: 0,
  });
  const [loading, setLoading] = useState(false);

  // Pobierz statystyki systemu przy otwarciu modala
  useEffect(() => {
    if (isOpen && file) {
      fetchSystemStats().then(setSystemStats);
    }
  }, [isOpen, file]);

  // Oblicz koszty przy zmianie parametrów - używamy useMemo zamiast useState + useEffect
  const calculation = useMemo<CostCalculationResult | null>(() => {
    if (file && systemStats.totalStorage >= 0) {
      const daysToCalculate = isIndefinite ? 30 : storageDays;
      return calculateStorageCost({
        fileSize: file.size,
        storageDays: daysToCalculate,
        currency,
        totalSystemUsage: systemStats.totalStorage,
      });
    }
    return null;
  }, [file, storageDays, isIndefinite, currency, systemStats.totalStorage]);

  if (!isOpen || !file) return null;

  const handleConfirm = () => {
    setLoading(true);
    try {
      onConfirm();
      // Modal will be closed by parent component, no need to reset loading here
      // Loading will be reset when modal reopens via useEffect
    } catch (error) {
      console.error("Error during upload confirm:", error);
      setLoading(false); // Reset loading only on error
    }
  };

  const handleClose = () => {
    if (!loading) {
      setLoading(false); // Reset loading state on close
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
      <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b sticky top-0 bg-white/95 backdrop-blur-sm z-10">
          <div className="flex items-center gap-2 sm:gap-3">
            <Calculator className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 shrink-0" />
            <div>
              <h2 className="text-base sm:text-xl font-semibold text-gray-900 font-roboto">
                Kalkulator kosztów
              </h2>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="no-min-touch text-gray-400 hover:text-gray-600 transition-colors p-1"
          >
            <X className="h-5 w-5 sm:h-6 sm:w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 sm:p-6 space-y-4 sm:space-y-6 pb-safe">
          {/* Informacje o pliku */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <h3 className="font-medium text-gray-900 mb-2 text-sm sm:text-base">
              Informacje o pliku
            </h3>
            <div className="space-y-1 text-xs sm:text-sm text-gray-600">
              <p>
                <span className="font-medium">Nazwa:</span>{" "}
                <span className="break-all">{file.name}</span>
              </p>
              <p>
                <span className="font-medium">Rozmiar:</span>{" "}
                {formatFileSize(file.size)}
              </p>
            </div>
          </div>

          {/* Parametry kalkulacji */}
          <div className="space-y-3 sm:space-y-4">
            <h3 className="font-medium text-gray-900 text-sm sm:text-base">
              Parametry kalkulacji
            </h3>

            {/* Czas przechowywania */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-2 gap-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700">
                  Czas przechowywania:{" "}
                  {isIndefinite ? "Bezterminowo" : `${storageDays} dni`}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="indefinite"
                    checked={isIndefinite}
                    onChange={(e) => setIsIndefinite(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="indefinite"
                    className="text-xs sm:text-sm text-gray-600"
                  >
                    Bezterminowo
                  </label>
                </div>
              </div>
              <input
                type="range"
                min="1"
                max="180"
                value={storageDays}
                onChange={(e) => setStorageDays(Number(e.target.value))}
                disabled={isIndefinite}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                  isIndefinite
                    ? "bg-gray-100 cursor-not-allowed"
                    : "bg-gray-200"
                }`}
              />
              <div className="flex justify-between text-[10px] sm:text-xs text-gray-500 mt-1">
                <span>1 dzień</span>
                <span>180 dni</span>
              </div>
            </div>

            {/* Waluta */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">
                Waluta
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCurrency("PLN")}
                  className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    currency === "PLN"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  PLN
                </button>
                <button
                  type="button"
                  onClick={() => setCurrency("USD")}
                  className={`px-3 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors ${
                    currency === "USD"
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  USD
                </button>
              </div>
            </div>
          </div>

          {/* Wyniki kalkulacji */}
          {calculation && (
            <div className="bg-blue-50 rounded-lg p-3 sm:p-4">
              <h3 className="font-medium text-gray-900 mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
                <Info className="h-4 w-4 text-blue-600 shrink-0" />
                Szacowany koszt
              </h3>

              {calculation.isFree ? (
                <div className="text-center py-3 sm:py-4">
                  <div className="text-xl sm:text-2xl font-bold text-green-600 mb-2">
                    Bezpłatne
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Plik mieści się w darmowym limicie Cloudflare R2
                  </p>
                </div>
              ) : (
                <div className="space-y-2 sm:space-y-3">
                  <div className="text-center">
                    <div className="text-xl sm:text-2xl font-bold text-blue-600">
                      {formatCost(
                        currency === "PLN"
                          ? calculation.costPLN
                          : calculation.costUSD,
                        currency
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600">
                      {isIndefinite
                        ? "za miesiąc przechowywania"
                        : `za ${storageDays} dni przechowywania`}
                    </p>
                  </div>

                  <div className="text-[10px] sm:text-xs text-gray-600 space-y-1">
                    <p>
                      • Darmowa część: {formatFileSize(calculation.freeSize)}
                    </p>
                    <p>
                      • Płatna część: {formatFileSize(calculation.paidSize)}
                    </p>
                    {!isIndefinite && (
                      <p>
                        • Koszt na 30 dni:{" "}
                        {formatCost(
                          currency === "PLN"
                            ? calculation.costPLN * (30 / storageDays)
                            : calculation.costUSD * (30 / storageDays),
                          currency
                        )}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Informacja o darmowym tierze */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
            <div className="flex items-start gap-2 sm:gap-3">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500 mt-0.5 shrink-0" />
              <div className="text-xs sm:text-sm text-yellow-800">
                <p className="font-medium mb-1">Darmowy tier Cloudflare R2</p>
                <p>
                  Pierwsze 10GB przechowywania jest darmowe dla całego systemu.
                </p>
                <p className="mt-1">
                  Aktualne użycie: {formatFileSize(systemStats.totalStorage)} /
                  10GB
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 sm:gap-3 p-4 sm:p-6 border-t sticky bottom-0 bg-white/95 backdrop-blur-sm">
          <Button
            variant="secondary"
            onClick={handleClose}
            disabled={loading}
            className="flex-1 text-xs sm:text-sm py-2.5 sm:py-2"
          >
            Anuluj
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={loading}
            className="flex-1 text-xs sm:text-sm py-2.5 sm:py-2"
          >
            <Upload className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 sm:mr-2" />
            {loading ? "Przesyłanie..." : "Wyślij na R2"}
          </Button>
        </div>
      </div>
    </div>
  );
}
