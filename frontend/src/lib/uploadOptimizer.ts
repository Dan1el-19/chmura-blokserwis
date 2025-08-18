export interface UploadMetrics {
  fileSize: number;
  networkSpeed: number; // Mbps
  systemPerformance: number; // 0-1
  historicalSuccess: number; // 0-1
  concurrentUploads: number;
  fileType?: string;
  userAgent?: string;
}

export interface PartSizeStrategy {
  minParts: number;
  maxParts: number;
  targetParts: number;
  partSize: number;
  confidence: number; // 0-1
}

export class UploadOptimizer {
  private static readonly MIN_PART_SIZE = 5 * 1024 * 1024; // 5MB
  private static readonly MAX_PART_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
  private static readonly MIN_PARTS = 1;
  private static readonly MAX_PARTS = 10000; // AWS S3 limit

  /**
   * Główna funkcja obliczająca optymalny rozmiar części
   */
  static calculateOptimalPartSize(metrics: UploadMetrics): PartSizeStrategy {
    const strategies = [
      this.sizeBasedStrategy(metrics),
      this.networkBasedStrategy(metrics),
      this.systemBasedStrategy(metrics),
      this.historicalBasedStrategy(metrics)
    ];

    // Ważona średnia wszystkich strategii
    const weightedStrategy = this.combineStrategies(strategies, metrics);
    
    // Dostosuj do ograniczeń AWS S3
    const finalPartSize = Math.max(
  this.MIN_PART_SIZE,
  Math.min(this.MAX_PART_SIZE, weightedStrategy.partSize)
    );

    const totalParts = Math.ceil(metrics.fileSize / finalPartSize);
    const finalParts = Math.max(this.MIN_PARTS, Math.min(this.MAX_PARTS, totalParts));

    return {
      minParts: this.MIN_PARTS,
      maxParts: this.MAX_PARTS,
      targetParts: finalParts,
      partSize: finalPartSize,
      confidence: weightedStrategy.confidence
    };
  }

  // Eksportowany getter dla minimalnego rozmiaru części
  static getMinPartSize(): number {
    return this.MIN_PART_SIZE;
  }

  /**
   * Strategia bazująca na wielkości pliku
   */
  private static sizeBasedStrategy(metrics: UploadMetrics): PartSizeStrategy {
    const fileSizeMB = metrics.fileSize / (1024 * 1024);
    
    // Bardziej agresywne skalowanie - mniej części dla większych plików
    // Cel: 1GB = ~4 części, 10GB = ~20 części
    const logSize = Math.log10(fileSizeMB + 1);
    
    let targetParts: number;
    
    // Specjalne traktowanie małych plików (< 100MB)
    if (fileSizeMB < 100) {
      // Dla małych plików: maksymalnie 5 części
      targetParts = Math.max(1, Math.min(5, Math.ceil(fileSizeMB / 20)));
    } else {
      // Dla większych plików: bardziej agresywne skalowanie
      targetParts = Math.max(2, Math.min(100, Math.pow(logSize, 1.5) * 15));
    }
    
    const partSize = metrics.fileSize / targetParts;

    return {
      minParts: 1,
      maxParts: 100,
      targetParts: Math.round(targetParts),
      partSize,
      confidence: 0.9 // Zwiększona pewność dla tej strategii
    };
  }

  /**
   * Strategia bazująca na prędkości sieci
   */
  private static networkBasedStrategy(metrics: UploadMetrics): PartSizeStrategy {
    const networkSpeed = metrics.networkSpeed;
    
    // Wolna sieć = mniejsze części (więcej retry)
    // Szybka sieć = większe części (mniej overhead)
    let targetParts: number;
    
    if (networkSpeed < 10) {
      targetParts = 50; // Wolna sieć - mniej części niż wcześniej
    } else if (networkSpeed < 50) {
      targetParts = 25; // Średnia sieć
    } else if (networkSpeed < 100) {
      targetParts = 15; // Szybka sieć
    } else {
      targetParts = 8; // Bardzo szybka sieć - bardzo duże części
    }

    const partSize = metrics.fileSize / targetParts;

    return {
      minParts: 5,
      maxParts: 50,
      targetParts,
      partSize,
      confidence: 0.8
    };
  }

  /**
   * Strategia bazująca na wydajności systemu
   */
  private static systemBasedStrategy(metrics: UploadMetrics): PartSizeStrategy {
    const performance = metrics.systemPerformance;
    const concurrent = metrics.concurrentUploads;
    
    // Słaby system = mniejsze części (mniej pamięci)
    // Silny system = większe części (lepsza wydajność)
    const systemFactor = performance * (1 - concurrent * 0.1);
    const targetParts = Math.max(10, Math.min(100, 50 / systemFactor));
    const partSize = metrics.fileSize / targetParts;

    return {
      minParts: 10,
      maxParts: 100,
      targetParts: Math.round(targetParts),
      partSize,
      confidence: 0.7
    };
  }

  /**
   * Strategia bazująca na historii udanych uploadów
   */
  private static historicalBasedStrategy(metrics: UploadMetrics): PartSizeStrategy {
    const successRate = metrics.historicalSuccess;
    
    // Niska skuteczność = mniejsze części (więcej retry)
    // Wysoka skuteczność = większe części (mniej overhead)
    const confidenceFactor = successRate * 0.5 + 0.5; // 0.5-1.0
    const targetParts = Math.max(10, Math.min(50, 30 / confidenceFactor));
    const partSize = metrics.fileSize / targetParts;

    return {
      minParts: 10,
      maxParts: 50,
      targetParts: Math.round(targetParts),
      partSize,
      confidence: successRate
    };
  }

  /**
   * Łączenie strategii z wagami
   */
  private static combineStrategies(strategies: PartSizeStrategy[], metrics: UploadMetrics): PartSizeStrategy {
    let totalWeight = 0;
    let weightedPartSize = 0;
    let weightedConfidence = 0;

    // Zoptymalizowane wagi - większa waga dla wielkości pliku
    const weights = {
      size: 0.6,      // Wielkość pliku - najważniejsza (60%)
      network: 0.25,  // Sieć - ważna (25%)
      system: 0.1,    // System - mniej ważna (10%)
      history: 0.05   // Historia - najmniej ważna (5%)
    };

    strategies.forEach((strategy, index) => {
      const weight = Object.values(weights)[index] ?? 0;
      totalWeight += weight;
      weightedPartSize += strategy.partSize * weight;
      weightedConfidence += strategy.confidence * weight;
    });

    // Zamień na średnią ważoną
    if (totalWeight > 0) {
      weightedPartSize = weightedPartSize / totalWeight;
      weightedConfidence = weightedConfidence / totalWeight;
    }

    return {
      minParts: Math.min(...strategies.map(s => s.minParts)),
      maxParts: Math.max(...strategies.map(s => s.maxParts)),
      targetParts: Math.max(1, Math.round(metrics.fileSize / weightedPartSize)),
      partSize: weightedPartSize,
      confidence: weightedConfidence
    };
  }

  /**
   * Pobieranie metryk systemu
   */
  static async getSystemMetrics(): Promise<Partial<UploadMetrics>> {
    const metrics: Partial<UploadMetrics> = {};

    // Wydajność systemu (uproszczona)
    if (typeof navigator !== 'undefined') {
      // Sprawdź dostępną pamięć
      if ('memory' in performance) {
        const memory = (performance as Performance & { memory: { jsHeapSizeLimit: number } }).memory;
        metrics.systemPerformance = Math.min(1, memory.jsHeapSizeLimit / (1024 * 1024 * 1024));
      } else {
        metrics.systemPerformance = 0.5; // Domyślna wartość
      }

      // User agent dla detekcji urządzenia
      metrics.userAgent = navigator.userAgent;
    }

    // Concurrent uploads (będzie ustawiane przez UploadManager)
    metrics.concurrentUploads = 1;

    return metrics;
  }

  /**
   * Pobieranie prędkości sieci
   */
  static async getNetworkSpeed(): Promise<number> {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as Navigator & { connection: { effectiveType?: string } }).connection;
      if (connection && connection.effectiveType) {
        // Mapowanie effectiveType na prędkość (Mbps)
        const speedMap: Record<string, number> = {
          'slow-2g': 5,
          '2g': 10,
          '3g': 25,
          '4g': 100,
          '5g': 1000
        };
        return speedMap[connection.effectiveType] || 50;
      }
    }
    
    return 50; // Domyślna prędkość
  }

  /**
   * Logowanie metryk dla analizy
   */
  static logMetrics(metrics: UploadMetrics, strategy: PartSizeStrategy): void {
    console.log('📊 Upload Optimization Metrics:', {
      fileSize: `${(metrics.fileSize / (1024 * 1024 * 1024)).toFixed(2)} GB`,
      networkSpeed: `${metrics.networkSpeed} Mbps`,
      systemPerformance: `${(metrics.systemPerformance * 100).toFixed(1)}%`,
      historicalSuccess: `${(metrics.historicalSuccess * 100).toFixed(1)}%`,
      concurrentUploads: metrics.concurrentUploads,
      strategy: {
        targetParts: strategy.targetParts,
        partSize: `${(strategy.partSize / (1024 * 1024)).toFixed(1)} MB`,
        confidence: `${(strategy.confidence * 100).toFixed(1)}%`
      }
    });
  }
}
