import { CostCalculationParams, CostCalculationResult, Currency } from '@/types';

// Stałe Cloudflare R2
const FREE_TIER_LIMIT = 10 * 1024 * 1024 * 1024; // 10GB w bajtach
const COST_PER_GB_PER_MONTH = 0.015; // $0.015/GB/30dni
const EXCHANGE_RATE = 3.65; // 1$ = 3.65 PLN

/**
 * Oblicza koszt przechowywania pliku w Cloudflare R2
 */
export function calculateStorageCost(params: CostCalculationParams): CostCalculationResult {
  const { fileSize, storageDays, totalSystemUsage } = params;
  
  // Oblicz pozostałe darmowe miejsce w systemie
  const remainingFreeSpace = Math.max(0, FREE_TIER_LIMIT - totalSystemUsage);
  
  // Oblicz ile z pliku będzie darmowe
  const freeSize = Math.min(fileSize, remainingFreeSpace);
  
  // Oblicz płatny rozmiar pliku
  const paidSize = Math.max(0, fileSize - freeSize);
  
  // Sprawdź czy plik jest całkowicie darmowy
  const isFree = paidSize === 0;
  
  if (isFree) {
    return {
      isFree: true,
      costUSD: 0,
      costPLN: 0,
      paidSize: 0,
      freeSize: fileSize,
      remainingFreeSpace,
      calculationDetails: {
        totalSystemUsage,
        freeTierLimit: FREE_TIER_LIMIT,
        paidSizeGB: 0,
        costPerGBPerMonth: COST_PER_GB_PER_MONTH,
        daysRatio: storageDays / 30
      }
    };
  }
  
  // Oblicz koszt w USD
  const paidSizeGB = paidSize / (1024 * 1024 * 1024); // konwersja na GB
  const daysRatio = storageDays / 30; // proporcja do pełnego miesiąca
  const costUSD = paidSizeGB * COST_PER_GB_PER_MONTH * daysRatio;
  
  // Oblicz koszt w PLN
  const costPLN = costUSD * EXCHANGE_RATE;
  
  return {
    isFree: false,
    costUSD: Math.round(costUSD * 100) / 100, // zaokrąglenie do 2 miejsc po przecinku
    costPLN: Math.round(costPLN * 100) / 100, // zaokrąglenie do 2 miejsc po przecinku
    paidSize,
    freeSize,
    remainingFreeSpace,
    calculationDetails: {
      totalSystemUsage,
      freeTierLimit: FREE_TIER_LIMIT,
      paidSizeGB,
      costPerGBPerMonth: COST_PER_GB_PER_MONTH,
      daysRatio
    }
  };
}

/**
 * Formatuje rozmiar pliku w czytelnym formacie
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Formatuje koszt w odpowiedniej walucie
 */
export function formatCost(amount: number, currency: Currency): string {
  if (currency === 'PLN') {
    return `${amount.toFixed(2)} PLN`;
  } else {
    return `$${amount.toFixed(2)}`;
  }
}

/**
 * Pobiera statystyki systemu z API
 */
export async function fetchSystemStats(): Promise<{ totalStorage: number }> {
  try {
    const response = await fetch('/api/system/stats');
    if (response.ok) {
      const data = await response.json();
      return { totalStorage: data.totalStorage || 0 };
    }
  } catch (error) {
    console.error('Błąd podczas pobierania statystyk systemu:', error);
  }
  
  return { totalStorage: 0 };
}

/**
 * Sprawdza czy plik powinien wyświetlić kalkulator kosztów
 */
export function shouldShowCostCalculator(fileSize: number): boolean {
  const MIN_SIZE_FOR_CALCULATOR = 1 * 1024 * 1024; // 1MB
  return fileSize >= MIN_SIZE_FOR_CALCULATOR;
}

/**
 * Generuje opis obliczeń dla tooltip
 */
export function generateCalculationDescription(result: CostCalculationResult, currency: Currency): string {
  if (result.isFree) {
    return `Plik mieści się w darmowym limicie (${formatFileSize(result.freeSize)}).`;
  }
  
  const { calculationDetails } = result;
  const cost = currency === 'PLN' ? result.costPLN : result.costUSD;
  const currencySymbol = currency === 'PLN' ? 'PLN' : '$';
  
  return `
    Rozmiar pliku: ${formatFileSize(result.paidSize + result.freeSize)}
    Darmowa część: ${formatFileSize(result.freeSize)}
    Płatna część: ${formatFileSize(result.paidSize)}
    Koszt: ${calculationDetails.paidSizeGB.toFixed(3)} GB × ${calculationDetails.costPerGBPerMonth}$ × ${calculationDetails.daysRatio.toFixed(2)} = ${cost} ${currencySymbol}
  `.trim();
}
