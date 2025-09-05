/**
 * Przykład integracji UppyUIManager z workflow kalkulatora kosztów
 * 
 * PLANNED WORKFLOW IMPLEMENTATION:
 * 1. Użytkownik wybiera plik → pokazuje się kalkulator kosztów
 * 2. Po potwierdzeniu → inicjalizuje się Uppy + pokazuje dashboard
 * 3. Upload rozpoczyna się automatycznie
 * 4. Po zakończeniu → dashboard chowa się automatycznie
 */

import { UppyUIManager } from './uppyUIManager';
import type { UppyUIManagerOptions, UppyUICallbacks } from './uppyUIManager';

interface CostInfo {
  storageCost: number;
  transferCost: number;
  totalCost: number;
}

export class MultipartUploadWorkflow {
  private uppyUIManager: UppyUIManager | null = null;
  private currentFile: File | null = null;
  private uploadFolder: 'personal' | 'main' = 'personal';
  private uploadSubPath?: string;

  /**
   * STEP 1: Użytkownik wybiera plik
   * Uruchamia workflow multipart upload z kalkulatorem kosztów
   */
  async handleFileSelection(
    file: File, 
    folder: 'personal' | 'main' = 'personal',
    subPath?: string
  ): Promise<void> {
    console.log('🗂️ File selected:', file.name, 'Size:', file.size);
    
    this.currentFile = file;
    this.uploadFolder = folder;
    this.uploadSubPath = subPath;

    // STEP 1.1: Sprawdź czy plik kwalifikuje się do multipart
    const shouldUseMultipart = this.shouldUseMultipartUpload(file);
    
    if (!shouldUseMultipart) {
      console.log('📤 File too small for multipart, using simple upload');
      // TODO: Fallback to simple upload
      return;
    }

    // STEP 1.2: Pokaż kalkulator kosztów
    await this.showCostCalculator(file, folder);
  }

  /**
   * STEP 2: Kalkulator kosztów - zgodnie z planned workflow
   */
  private async showCostCalculator(file: File, folder: 'personal' | 'main'): Promise<void> {
    try {
      console.log('💰 Calculating upload costs...');
      
      const costInfo: CostInfo = {
        storageCost: file.size * 0.000001, // Przykładowe obliczenie
        transferCost: file.size * 0.0000005,
        totalCost: file.size * 0.0000015
      };

      console.log('💰 Upload cost calculated:', costInfo);

      // Symulacja modal kalkulatora kosztów
      const userConfirmed = await this.showCostCalculatorModal(file, costInfo);
      
      if (userConfirmed) {
        console.log('✅ User confirmed upload - initializing Uppy...');
        await this.initializeUploadInterface(file, folder, this.uploadSubPath);
      } else {
        console.log('❌ User cancelled upload');
      }
    } catch (error) {
      console.error('❌ Error calculating costs:', error);
    }
  }

  /**
   * STEP 3: LAZY INITIALIZATION - Uppy inicjalizuje się dopiero po potwierdzeniu
   * Zgodnie z planned workflow
   */
  private async initializeUploadInterface(
    file: File, 
    folder: 'personal' | 'main', 
    subPath?: string
  ): Promise<void> {
    try {
      console.log('🚀 Initializing Uppy UI Manager for multipart upload...');

      // Stwórz UppyUIManager z konfiguracją
      const options: UppyUIManagerOptions = {
        inline: false, // Modal overlay
        height: 500,
        width: '100%',
        showProgressDetails: true,
        proudlyDisplayPoweredByUppy: false,
        showRemoveButton: true,
        doneButtonHandler: () => this.onUploadComplete()
      };

      this.uppyUIManager = new UppyUIManager(options);

      // Ustaw callbacki dla UI events
      const callbacks: UppyUICallbacks = {
        onProgress: (progress: number, bytes: number, speed: number) => {
          console.log(`📊 Progress: ${progress}%, ${this.formatBytes(bytes)} uploaded, ${this.formatSpeed(speed)}`);
          this.updateProgressUI(progress, bytes, speed);
        },
        onStatusChange: (status: string) => {
          console.log(`📱 Status changed: ${status}`);
          this.updateStatusUI(status);
        },
        onError: (error: string) => {
          console.error('❌ Upload error:', error);
          this.showErrorUI(error);
        },
        onComplete: () => {
          console.log('✅ Upload completed!');
          this.onUploadComplete();
        },
        onStarted: () => {
          console.log('🚀 Upload started');
          this.updateStatusUI('started');
        },
        onPaused: () => {
          console.log('⏸️ Upload paused');
          this.updateStatusUI('paused');
        },
        onResumed: () => {
          console.log('▶️ Upload resumed');
          this.updateStatusUI('resumed');
        }
      };

      this.uppyUIManager.setCallbacks(callbacks);

      // LAZY INITIALIZATION - Uppy inicjalizuje się dopiero teraz
      await this.uppyUIManager.initializeUppy(file, folder, subPath);

      // STEP 4: Pokaż Uppy Dashboard
      this.showUploadDashboard();

    } catch (error) {
      console.error('❌ Failed to initialize upload interface:', error);
    }
  }

  /**
   * STEP 4: Pokazuje Uppy Dashboard i rozpoczyna upload
   * Dashboard pokazuje się dopiero po potwierdzeniu w kalkulatorze
   */
  private showUploadDashboard(): void {
    if (!this.uppyUIManager) {
      throw new Error('UppyUIManager not initialized');
    }

    try {
      console.log('📱 Showing Uppy Dashboard...');
      
      // Pokaż dashboard (zgodnie z planned workflow)
      this.uppyUIManager.showDashboard();
      
      // Automatycznie rozpocznij upload (zgodnie z planem)
      setTimeout(() => {
        this.startUpload();
      }, 1000); // Daj użytkownikowi chwilę na zobaczenie interface
      
    } catch (error) {
      console.error('❌ Failed to show upload dashboard:', error);
    }
  }

  /**
   * Rozpoczyna upload
   */
  private startUpload(): void {
    if (!this.uppyUIManager) {
      throw new Error('UppyUIManager not initialized');
    }

    console.log('🚀 Starting multipart upload...');
    this.uppyUIManager.startUpload();
  }

  /**
   * Kontrole uploadu
   */
  pauseUpload(): void {
    this.uppyUIManager?.pauseUpload();
  }

  resumeUpload(): void {
    this.uppyUIManager?.resumeUpload();
  }

  cancelUpload(): void {
    console.log('❌ Cancelling upload...');
    this.uppyUIManager?.cancelUpload();
    this.cleanup();
  }

  /**
   * STEP 5: Upload completed - zgodnie z planned workflow
   * Dashboard chowa się automatycznie
   */
  private onUploadComplete(): void {
    console.log('🎉 Upload workflow completed!');
    
    // Dashboard chowa się automatycznie przez UppyUIManager
    // Wyczyść po sobie
    setTimeout(() => {
      this.cleanup();
    }, 3000);
  }

  /**
   * Czyszczenie po zakończeniu workflow
   */
  private cleanup(): void {
    if (this.uppyUIManager) {
      this.uppyUIManager.destroy();
      this.uppyUIManager = null;
    }
    
    this.currentFile = null;
    this.uploadFolder = 'personal';
    this.uploadSubPath = undefined;
    
    console.log('🧹 Workflow cleanup completed');
  }

  // === HELPER METHODS ===

  /**
   * Sprawdza czy plik powinien używać multipart upload
   */
  private shouldUseMultipartUpload(file: File): boolean {
    const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB
    return file.size > MULTIPART_THRESHOLD;
  }

  /**
   * Symuluje modal kalkulatora kosztów
   */
  private async showCostCalculatorModal(file: File, costInfo: CostInfo): Promise<boolean> {
    // W rzeczywistej implementacji byłby to prawdziwy modal
    console.log('💰 Cost Calculator Modal:');
    console.log(`File: ${file.name} (${this.formatBytes(file.size)})`);
    console.log(`Storage cost: $${costInfo.storageCost}`);
    console.log(`Transfer cost: $${costInfo.transferCost}`);
    console.log(`Total: $${costInfo.totalCost}`);
    
    // Symulacja potwierdzenia użytkownika
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('✅ User confirmed (simulated)');
        resolve(true);
      }, 2000);
    });
  }

  /**
   * Aktualizuje UI progress
   */
  private updateProgressUI(progress: number, bytes: number, speed: number): void {
    // W rzeczywistej implementacji aktualizowałby UI
    console.log(`UI Progress: ${progress}% - ${this.formatBytes(bytes)} at ${this.formatSpeed(speed)}`);
  }

  /**
   * Aktualizuje UI status
   */
  private updateStatusUI(status: string): void {
    console.log(`UI Status: ${status}`);
  }

  /**
   * Pokazuje błąd w UI
   */
  private showErrorUI(error: string): void {
    console.error(`UI Error: ${error}`);
  }

  /**
   * Formatuje bytes do readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Formatuje speed do readable format
   */
  private formatSpeed(bytesPerSecond: number): string {
    return this.formatBytes(bytesPerSecond) + '/s';
  }
}

// === PRZYKŁAD UŻYCIA ===

/**
 * Funkcja do uruchomienia workflow z file input
 */
export function setupMultipartUploadWorkflow(): void {
  const workflow = new MultipartUploadWorkflow();

  // Przykład: File input handler
  const fileInput = document.getElementById('file-input') as HTMLInputElement;
  if (fileInput) {
    fileInput.addEventListener('change', async (event) => {
      const files = (event.target as HTMLInputElement).files;
      if (files && files.length > 0) {
        const file = files[0];
        
        // Rozpocznij workflow
        await workflow.handleFileSelection(
          file,
          'personal', // folder
          undefined   // subPath
        );
      }
    });
  }

  console.log('🔧 Multipart upload workflow setup completed');
}

/**
 * Export głównej klasy workflow
 */
