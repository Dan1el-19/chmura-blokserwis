import { UppyMultipartEngine } from './uppyMultipartEngine';
import type { Uppy } from '@uppy/core';

/**
 * Opcje konfiguracyjne dla UppyUIManager
 */
export interface UppyUIManagerOptions {
  target?: HTMLElement | string;
  inline?: boolean;
  height?: number;
  width?: string | number;
  showProgressDetails?: boolean;
  proudlyDisplayPoweredByUppy?: boolean;
  showRemoveButton?: boolean;
  doneButtonHandler?: () => void;
}

/**
 * Callbacki dla UI events
 */
export interface UppyUICallbacks {
  onProgress?: (progress: number, bytes: number, speed: number) => void;
  onStatusChange?: (status: string) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
  onStarted?: () => void;
  onPaused?: () => void;
  onResumed?: () => void;
}

/**
 * UppyUIManager - Zarządza interfejsem użytkownika dla Uppy
 * 
 * LAZY INITIALIZATION PATTERN - zgodnie z planem:
 * 1. Manager tworzy się wcześnie, ale Uppy inicjalizuje się dopiero po potwierdzeniu w kalkulatorze
 * 2. Dashboard pokazuje się DOPIERO po potwierdzeniu uploadu
 * 3. Po zakończeniu upload - dashboard chowa się automatycznie
 */
export class UppyUIManager {
  private uppyEngine: UppyMultipartEngine | null = null;
  private initialized: boolean = false;
  private currentFile: File | null = null;
  private callbacks: UppyUICallbacks = {};

  constructor(private options: UppyUIManagerOptions = {}) {
    this.options = {
      inline: false, // Default to modal for multipart
      height: 500,
      width: '100%',
      showProgressDetails: true,
      proudlyDisplayPoweredByUppy: false,
      showRemoveButton: true,
      ...this.options
    };
  }

  /**
   * LAZY INITIALIZATION - wywołuje się DOPIERO po potwierdzeniu w kalkulatorze
   * Zgodnie z planem: Uppy inicjalizuje się dopiero po potwierdzeniu uploadu
   */
  async initializeUppy(
    file: File, 
    folder: 'personal' | 'main', 
    subPath?: string
  ): Promise<void> {
    if (this.initialized) {
      console.warn('UppyUIManager already initialized');
      return;
    }

    try {
      this.currentFile = file;
      
      // Stwórz UppyMultipartEngine z opcjami UI
      this.uppyEngine = new UppyMultipartEngine({
        ...this.options,
        target: this.options.target || this.createModalContainer()
      });

      // Inicjalizuj Uppy z plikiem
      await this.uppyEngine.initializeUppy(file, folder, subPath);

      // Ustaw callbacki forwarding
      this.uppyEngine.setCallbacks({
        onProgress: (progress, bytes, speed) => {
          this.callbacks.onProgress?.(progress, bytes, speed);
        },
        onStatusChange: (status) => {
          this.callbacks.onStatusChange?.(status);
          
          // Auto-hide dashboard on completion/error
          if (status === 'completed' || status === 'error') {
            setTimeout(() => this.hideDashboard(), 2000);
          }
        },
        onError: (error) => {
          this.callbacks.onError?.(error);
          setTimeout(() => this.hideDashboard(), 3000);
        },
        onComplete: () => {
          this.callbacks.onComplete?.();
          setTimeout(() => this.hideDashboard(), 2000);
        },
        onStarted: () => {
          this.callbacks.onStarted?.();
        },
        onPaused: () => {
          this.callbacks.onPaused?.();
        },
        onResumed: () => {
          this.callbacks.onResumed?.();
        }
      });

      this.initialized = true;
      // console.log('🚀 UppyUIManager initialized successfully for multipart upload');
      
    } catch (error) {
      console.error('❌ Failed to initialize UppyUIManager:', error);
      this.callbacks.onError?.('Failed to initialize upload interface');
      throw error;
    }
  }

  /**
   * Pokazuje Uppy Dashboard - LAZY UI zgodnie z planem
   * Dashboard pokazuje się DOPIERO po potwierdzeniu w kalkulatorze
   */
  showDashboard(): void {
    if (!this.initialized || !this.uppyEngine) {
      throw new Error('UppyUIManager not initialized. Call initializeUppy() first.');
    }

    try {
      // Pokaż dashboard przez engine
      this.uppyEngine.showDashboard();
      
      // Dodaj plik do Uppy (zgodnie z workflow)
      if (this.currentFile) {
        this.uppyEngine.addFileToUppy(this.currentFile);
      }
      
      // Pokaż modal container
      const modal = document.getElementById('uppy-modal-container');
      if (modal) {
        modal.style.display = 'flex';
      }
      
      // console.log('📱 Uppy Dashboard shown - ready for multipart upload');
    } catch (error) {
      console.error('❌ Failed to show Uppy Dashboard:', error);
      this.callbacks.onError?.('Failed to show upload interface');
    }
  }

  /**
   * Ukrywa Uppy Dashboard
   */
  hideDashboard(): void {
    if (this.uppyEngine) {
      try {
        this.uppyEngine.hideDashboard();
        
        // Ukryj modal container
        const modal = document.getElementById('uppy-modal-container');
        if (modal) {
          modal.style.display = 'none';
        }
        
        console.log('📱 Uppy Dashboard hidden');
      } catch (error) {
        console.error('❌ Failed to hide Uppy Dashboard:', error);
      }
    }
  }

  /**
   * Automatycznie dodaje plik do Uppy (po pokazaniu dashboard)
   */
  addFileToUppy(file: File): void {
    if (!this.initialized || !this.uppyEngine) {
      throw new Error('UppyUIManager not initialized');
    }

    this.currentFile = file;
    this.uppyEngine.addFileToUppy(file);
  }

  /**
   * Rozpoczyna upload - zgodnie z workflow
   */
  startUpload(): void {
    if (!this.initialized || !this.uppyEngine) {
      throw new Error('UppyUIManager not initialized');
    }

    // console.log('🚀 Starting multipart upload...');
    this.uppyEngine.startUpload();
  }

  /**
   * Pauzuje upload
   */
  pauseUpload(): void {
    if (this.uppyEngine) {
      // console.log('⏸️ Pausing multipart upload...');
      this.uppyEngine.pauseUpload();
    }
  }

  /**
   * Wznawia upload
   */
  resumeUpload(): void {
    if (this.uppyEngine) {
      // console.log('▶️ Resuming multipart upload...');
      this.uppyEngine.resumeUpload();
    }
  }

  /**
   * Anuluje upload
   */
  cancelUpload(): void {
    if (this.uppyEngine) {
      // console.log('❌ Canceling multipart upload...');
      this.uppyEngine.cancelUpload();
      this.hideDashboard();
    }
  }

  /**
   * Sprawdza czy jest zainicjalizowany
   */
  isUppyInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Pobiera instancję Uppy (przez engine)
   */
  getUppyInstance(): Uppy | null {
    return this.uppyEngine?.getUppyInstance() || null;
  }

  /**
   * Ustawia callbacki dla UI events
   */
  setCallbacks(callbacks: UppyUICallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Resetuje manager (dla nowego uploadu)
   */
  reset(): void {
    // console.log('🔄 Resetting UppyUIManager...');
    
    if (this.uppyEngine) {
      this.uppyEngine.reset();
    }
    
    this.hideDashboard();
    this.uppyEngine = null;
    this.currentFile = null;
    this.initialized = false;
    this.callbacks = {};
  }

  /**
   * Niszczy manager
   */
  destroy(): void {
    // console.log('💥 Destroying UppyUIManager...');
    
    if (this.uppyEngine) {
      this.uppyEngine.destroy();
    }
    
    this.removeModalContainer();
    this.uppyEngine = null;
    this.currentFile = null;
    this.initialized = false;
    this.callbacks = {};
  }

  /**
   * Tworzy kontener modal dla dashboard (gdy nie inline)
   */
  private createModalContainer(): HTMLElement {
    const modal = document.createElement('div');
    modal.id = 'uppy-modal-container';
    modal.className = 'uppy-modal-overlay';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      z-index: 1000;
      display: none;
      align-items: center;
      justify-content: center;
    `;

    const container = document.createElement('div');
    container.className = 'uppy-modal-content';
    container.style.cssText = `
      width: 90%;
      max-width: 800px;
      height: 80%;
      max-height: 600px;
      background: white;
      border-radius: 8px;
      overflow: hidden;
      position: relative;
    `;

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.innerHTML = '×';
    closeBtn.className = 'uppy-modal-close';
    closeBtn.style.cssText = `
      position: absolute;
      top: 10px;
      right: 15px;
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      z-index: 1001;
    `;
    closeBtn.onclick = () => this.hideDashboard();

    container.appendChild(closeBtn);
    modal.appendChild(container);
    document.body.appendChild(modal);

    return container;
  }

  /**
   * Usuwa modal container
   */
  private removeModalContainer(): void {
    const modal = document.getElementById('uppy-modal-container');
    if (modal) {
      document.body.removeChild(modal);
    }
  }
}
