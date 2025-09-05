/**
 * Inteligentny algorytm optymalizacji chunków dla multipart upload
 * Zgodny z limitami Cloudflare R2 / AWS S3
 */

// Stałe limitów R2/S3 API
export const R2_LIMITS = {
  MIN_CHUNK_SIZE: 5 * 1024 * 1024,      // 5 MB minimum
  MAX_CHUNK_SIZE: 5 * 1024 * 1024 * 1024, // 5 GB maximum
  MAX_NUM_CHUNKS: 10000,                 // Maksymalna liczba części
  MIN_MULTIPART_SIZE: 5 * 1024 * 1024,  // Plik musi być > 5MB dla multipart
} as const;

// Strategiczne cele optymalizacji
export const OPTIMIZATION_TARGETS = {
  SMALL_FILE_CHUNKS: 20,    // Dla plików < 100MB
  MEDIUM_FILE_CHUNKS: 50,   // Dla plików 100MB - 10GB  
  LARGE_FILE_CHUNKS: 100,   // Dla plików > 10GB
  MAX_CONCURRENT: 5,        // Maksymalna liczba równoczesnych chunków
} as const;

export interface ChunkOptimizationResult {
  chunkSize: number;
  numChunks: number;
  strategy: ChunkStrategy;
  metadata: ChunkMetadata;
}

export interface ChunkMetadata {
  fileSizeMB: number;
  chunkSizeMB: number;
  estimatedUploadTime: string;
  concurrencyRecommendation: number;
  networkEfficiency: 'optimal' | 'good' | 'acceptable' | 'suboptimal';
}

export type ChunkStrategy = 
  | 'single-chunk'      // Plik < 5MB, jedna część
  | 'small-file'        // < 100MB, 20 chunków
  | 'medium-file'       // 100MB-10GB, 50 chunków
  | 'large-file'        // > 10GB, 100 chunków
  | 'size-constrained'  // Ograniczony przez limity R2
  | 'count-constrained'; // Ograniczony przez max chunks

/**
 * Główna funkcja optymalizacji chunków
 */
export function optimizeChunks(fileSize: number): ChunkOptimizationResult {
  // Walidacja wejściowa
  if (fileSize <= 0) {
    throw new Error('File size must be positive');
  }

  // Sprawdź czy plik wymaga multipart upload
  if (fileSize < R2_LIMITS.MIN_MULTIPART_SIZE) {
    return createSingleChunkResult(fileSize);
  }

  // FAZA 1: Wstępna optymalizacja
  const targetChunks = selectTargetChunks(fileSize);
  let chunkSize = Math.ceil(fileSize / targetChunks);

  // FAZA 2: Weryfikacja i korekta limitów
  chunkSize = enforceChunkSizeLimits(chunkSize);
  const numChunks = Math.ceil(fileSize / chunkSize);

  // FAZA 3: Ostateczna weryfikacja
  const finalResult = enforceFinalLimits(fileSize, chunkSize, numChunks);
  
  // FAZA 4: Oblicz metadata i rekomendacje
  const metadata = calculateMetadata(fileSize, finalResult.chunkSize, finalResult.numChunks);
  const strategy = determineStrategy(fileSize, finalResult.numChunks);

  return {
    chunkSize: finalResult.chunkSize,
    numChunks: finalResult.numChunks,
    strategy,
    metadata
  };
}

/**
 * Tworzy wynik dla plików jednej części
 */
function createSingleChunkResult(fileSize: number): ChunkOptimizationResult {
  return {
    chunkSize: fileSize,
    numChunks: 1,
    strategy: 'single-chunk',
    metadata: {
      fileSizeMB: Math.round(fileSize / (1024 * 1024) * 100) / 100,
      chunkSizeMB: Math.round(fileSize / (1024 * 1024) * 100) / 100,
      estimatedUploadTime: '< 1 min',
      concurrencyRecommendation: 1,
      networkEfficiency: 'optimal'
    }
  };
}

/**
 * Wybiera docelową liczbę chunków na podstawie rozmiaru pliku
 */
function selectTargetChunks(fileSize: number): number {
  const sizeMB = fileSize / (1024 * 1024);
  
  if (sizeMB < 100) {
    return OPTIMIZATION_TARGETS.SMALL_FILE_CHUNKS;  // 20 chunków
  } else if (sizeMB < 10 * 1024) { // < 10GB
    return OPTIMIZATION_TARGETS.MEDIUM_FILE_CHUNKS; // 50 chunków
  } else {
    return OPTIMIZATION_TARGETS.LARGE_FILE_CHUNKS;  // 100 chunków
  }
}

/**
 * Wymusza limity rozmiaru chunka
 */
function enforceChunkSizeLimits(chunkSize: number): number {
  // Weryfikacja minimalnego rozmiaru chunku
  if (chunkSize < R2_LIMITS.MIN_CHUNK_SIZE) {
    chunkSize = R2_LIMITS.MIN_CHUNK_SIZE;
  }
  
  // Weryfikacja maksymalnego rozmiaru chunku
  if (chunkSize > R2_LIMITS.MAX_CHUNK_SIZE) {
    chunkSize = R2_LIMITS.MAX_CHUNK_SIZE;
  }
  
  return chunkSize;
}

/**
 * Ostateczna weryfikacja i korekta
 */
function enforceFinalLimits(fileSize: number, chunkSize: number, numChunks: number): {
  chunkSize: number;
  numChunks: number;
} {
  // Ostateczna weryfikacja liczby chunków
  if (numChunks > R2_LIMITS.MAX_NUM_CHUNKS) {
    // Plik jest za duży - zwiększ rozmiar chunka do maksimum
    const correctedChunkSize = Math.ceil(fileSize / R2_LIMITS.MAX_NUM_CHUNKS);
    
    if (correctedChunkSize > R2_LIMITS.MAX_CHUNK_SIZE) {
      throw new Error(
        `File too large for multipart upload. ` +
        `Maximum supported size: ${formatBytes(R2_LIMITS.MAX_NUM_CHUNKS * R2_LIMITS.MAX_CHUNK_SIZE)}`
      );
    }
    
    return {
      chunkSize: correctedChunkSize,
      numChunks: Math.ceil(fileSize / correctedChunkSize)
    };
  }
  
  return { chunkSize, numChunks };
}

/**
 * Oblicza metadata i rekomendacje wydajności
 */
function calculateMetadata(fileSize: number, chunkSize: number, numChunks: number): ChunkMetadata {
  const fileSizeMB = Math.round(fileSize / (1024 * 1024) * 100) / 100;
  const chunkSizeMB = Math.round(chunkSize / (1024 * 1024) * 100) / 100;
  
  // Estymacja czasu uploadu (zakładając 10 Mbps średnio)
  const estimatedTimeMin = Math.ceil((fileSizeMB * 8) / (10 * 60)); // MB to Mbits / 10Mbps / 60sec
  const estimatedUploadTime = estimatedTimeMin < 1 ? '< 1 min' : 
                             estimatedTimeMin < 60 ? `${estimatedTimeMin} min` :
                             `${Math.ceil(estimatedTimeMin / 60)}h ${estimatedTimeMin % 60}min`;
  
  // Rekomendacja concurrency na podstawie rozmiaru chunków
  const concurrencyRecommendation = chunkSizeMB < 10 ? 5 :
                                   chunkSizeMB < 50 ? 4 :
                                   chunkSizeMB < 100 ? 3 : 2;
  
  // Ocena efektywności sieciowej
  const networkEfficiency = evaluateNetworkEfficiency(chunkSizeMB, numChunks);
  
  return {
    fileSizeMB,
    chunkSizeMB,
    estimatedUploadTime,
    concurrencyRecommendation,
    networkEfficiency
  };
}

/**
 * Określa strategię na podstawie finalnych parametrów
 */
function determineStrategy(fileSize: number, numChunks: number): ChunkStrategy {
  const sizeMB = fileSize / (1024 * 1024);
  
  if (numChunks === 1) return 'single-chunk';
  if (numChunks >= R2_LIMITS.MAX_NUM_CHUNKS * 0.9) return 'count-constrained';
  if (sizeMB < 100) return 'small-file';
  if (sizeMB < 10 * 1024) return 'medium-file';
  return 'large-file';
}

/**
 * Ocenia efektywność sieciową
 */
function evaluateNetworkEfficiency(chunkSizeMB: number, numChunks: number): ChunkMetadata['networkEfficiency'] {
  // Optymalne chunki: 10-100MB, 20-100 części
  if (chunkSizeMB >= 10 && chunkSizeMB <= 100 && numChunks >= 20 && numChunks <= 100) {
    return 'optimal';
  }
  if (chunkSizeMB >= 5 && chunkSizeMB <= 200 && numChunks >= 10 && numChunks <= 200) {
    return 'good';
  }
  if (chunkSizeMB >= 5 && numChunks <= 1000) {
    return 'acceptable';
  }
  return 'suboptimal';
}

/**
 * Formatuje bajty do czytelnej formy
 */
function formatBytes(bytes: number): string {
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 B';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Sprawdza czy plik jest odpowiedni do multipart upload
 */
export function shouldUseMultipart(fileSize: number): boolean {
  return fileSize >= R2_LIMITS.MIN_MULTIPART_SIZE;
}

/**
 * Oblicza maksymalny obsługiwany rozmiar pliku
 */
export function getMaxSupportedFileSize(): number {
  return R2_LIMITS.MAX_NUM_CHUNKS * R2_LIMITS.MAX_CHUNK_SIZE;
}

/**
 * Waliduje czy plik może być przesłany
 */
export function validateFileSize(fileSize: number): {
  isValid: boolean;
  error?: string;
  recommendation?: string;
} {
  const maxSize = getMaxSupportedFileSize();
  
  if (fileSize <= 0) {
    return {
      isValid: false,
      error: 'File size must be positive'
    };
  }
  
  if (fileSize > maxSize) {
    return {
      isValid: false,
      error: `File too large. Maximum supported size: ${formatBytes(maxSize)}`,
      recommendation: 'Consider splitting the file or using a different upload method'
    };
  }
  
  return { isValid: true };
}

/**
 * Debug helper - loguje szczegóły optymalizacji
 */
export function logOptimizationDetails(fileSize: number, result: ChunkOptimizationResult): void {
  // Minimalne logowanie - tylko kluczowe informacje  
  console.log(`🎯 Chunks: ${result.numChunks} × ${result.metadata.chunkSizeMB}MB (${result.strategy})`);
}

/**
 * Eksportuje główną funkcję jako default
 */
export default optimizeChunks;
