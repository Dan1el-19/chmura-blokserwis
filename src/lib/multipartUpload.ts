import { 
  MultipartUploadState, 
  MultipartUploadHandle, 
  Part, 
  MultipartUploadOptions,
  MultipartUploadStats,
  ChunkInfo
} from '@/types/multipart';
import { auth } from '@/lib/firebase';
import optimizeChunks, { 
  shouldUseMultipart, 
  validateFileSize, 
  logOptimizationDetails 
} from '@/lib/chunkOptimizer';

export class MultipartUploadManager {
  private uploads: Map<string, MultipartUploadState> = new Map();
  private uploadHandles: Map<string, MultipartUploadHandle> = new Map();
  private chunkInfo: Map<string, ChunkInfo[]> = new Map();
  private activeChunks: Map<string, Set<number>> = new Map();
  private activeRequests: Map<string, Map<number, XMLHttpRequest>> = new Map(); // Track active XHR requests
  private retryCounts: Map<string, Map<number, number>> = new Map();
  private completionInProgress: Set<string> = new Set();
  private options: MultipartUploadOptions;

  constructor(options: MultipartUploadOptions = {}) {
    this.options = {
      maxConcurrentChunks: 3, // Będzie dostosowane przez algorytm optymalizacji
      retryAttempts: 3,
      retryDelay: 1000,
      ...options
    };
  }

  /**
   * Rozpoczyna nowy multipart upload
   */
  async startUpload(file: File, folder: 'personal' | 'main', subPath?: string): Promise<string> {
    const uploadId = `${Date.now()}_${Math.random().toString(36).substr(2, 11)}`;
    
    // Wygeneruj key dla R2
    const userId = auth.currentUser?.uid;
    if (!userId) throw new Error('User not authenticated');
    
    let key: string;
    if (folder === 'main') {
      key = subPath ? `main/${subPath}/${file.name}` : `main/${file.name}`;
    } else {
      key = subPath ? `users/${userId}/${subPath}/${file.name}` : `users/${userId}/${file.name}`;
    }

    // Utwórz upload state
    const uploadState: MultipartUploadState = {
      id: uploadId,
      uploadId: '', // Will be set after R2 initiation
      key,
      fileName: file.name,
      fileSize: file.size,
      file,
      folder,
      subPath,
      status: 'initializing',
      parts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      progress: 0,
      bytesUploaded: 0,
      speed: 0,
      etaSec: null
    };

    this.uploads.set(uploadId, uploadState);

    // Podziel plik na chunki z inteligentnym algorytmem
    const chunks = this.calculateOptimalChunks(file);
    this.chunkInfo.set(uploadId, chunks);
    this.activeChunks.set(uploadId, new Set());
    this.activeRequests.set(uploadId, new Map()); // Initialize active requests map

    // Zredukowano logi - tylko kluczowe informacje
    // console.log(`🚀 Starting multipart upload: ${file.name} (${file.size} bytes, ${chunks.length} chunks, ${Math.round(chunks[0]?.size / (1024 * 1024))}MB per chunk)`);

    try {
      // Inicjuj multipart upload na R2
      const r2UploadId = await this.initiateUploadOnR2(uploadState);
      uploadState.uploadId = r2UploadId;
      uploadState.status = 'uploading';

      // Rozpocznij upload chunków
      this.startChunkUploads(uploadId);

      return uploadId;
    } catch (error) {
      uploadState.status = 'error';
      uploadState.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw error;
    }
  }

  /**
   * Tworzy handle do upload'u (dla kompatybilności z UploadContext)
   */
  async createUpload(file: File, folder: 'personal' | 'main', subPath?: string): Promise<MultipartUploadHandle> {
    const uploadId = await this.startUpload(file, folder, subPath);
    const upload = this.uploads.get(uploadId)!;

    const handle: MultipartUploadHandle = {
      id: uploadId,
      uploadId: upload.uploadId,
      key: upload.key,
      fileName: file.name,
      fileSize: file.size,
      folder,
      subPath,
      status: upload.status,
      progress: upload.progress,
      bytesUploaded: upload.bytesUploaded,
      speed: upload.speed,
      etaSec: upload.etaSec,
      parts: upload.parts,
      
      // Actions
      pause: async () => {
        upload.status = 'paused';
        // console.log('⏸️ Upload paused:', uploadId);
      },
      resume: async () => {
        upload.status = 'uploading';
        // console.log('▶️ Upload resumed:', uploadId);
        this.startChunkUploads(uploadId);
      },
      cancel: async () => {
        await this.abortUpload(uploadId);
      },
      abort: async () => {
        await this.abortUpload(uploadId);
      }
    };

    // Zapisz handle
    this.uploadHandles.set(uploadId, handle);

    return handle;
  }

  /**
   * Uploaduje pojedynczy chunk
   */
  private async uploadPart(uploadId: string, partNumber: number, chunk: Blob): Promise<Part> {
    const upload = this.uploads.get(uploadId);
    if (!upload) throw new Error(`Upload ${uploadId} not found`);

    // Sprawdź status przed rozpoczęciem uploadu
    if (upload.status === 'paused') {
      throw new Error(`Upload ${uploadId} is paused`);
    }
    
    if (upload.status === 'aborted') {
      throw new Error(`Upload ${uploadId} is aborted`);
    }

    const chunkInfo = this.chunkInfo.get(uploadId)?.find(c => c.partNumber === partNumber);
    if (!chunkInfo) throw new Error(`Chunk ${partNumber} not found`);

    try {
      // Oznacz chunk jako uploading
      chunkInfo.status = 'uploading';
      
      // Pobierz presigned URL
      const presignedUrl = await this.getPresignedUrlForPart(upload, partNumber);
      
      // Upload chunk do R2
      const etag = await this.uploadChunkToR2(presignedUrl, chunk, uploadId, partNumber);

      // Utwórz part object
      const part: Part = {
        partNumber,
        etag,
        size: chunk.size,
        uploadedAt: new Date(),
        status: 'completed'
      };

      // Dodaj do uploadu (z deduplikacją)
      const existingPartIndex = upload.parts.findIndex(p => p.partNumber === partNumber);
      if (existingPartIndex >= 0) {
        upload.parts[existingPartIndex] = part;
      } else {
        upload.parts.push(part);
      }
      
      upload.bytesUploaded += chunk.size;
      upload.updatedAt = new Date();

      // Aktualizuj stats
      this.updateSpeedStats(upload);

      // Aktualizuj handle (bez progress - mamy już real-time tracking)
      const handle = this.uploadHandles.get(uploadId);
      if (handle) {
        handle.bytesUploaded = upload.bytesUploaded;
        handle.speed = upload.speed;
        handle.etaSec = upload.etaSec;
        handle.status = upload.status;
        handle.parts = [...upload.parts];
      }

      // Oznacz chunk jako ukończony
      chunkInfo.status = 'completed';
      chunkInfo.uploadedBytes = chunkInfo.size; // Ustaw pełny rozmiar po zakończeniu
      this.activeChunks.get(uploadId)?.delete(partNumber);

      // Sprawdź czy wszystkie chunki są ukończone
      if (this.areAllChunksCompleted(uploadId) && !this.completionInProgress.has(uploadId)) {
        // Dodatkowe sprawdzenie czy upload już nie został zakończony
        const currentUpload = this.uploads.get(uploadId);
        if (currentUpload?.status === 'completed') {
          // console.log('✅ Upload already completed, skipping finalization:', uploadId);
          return part;
        }
        
        this.completionInProgress.add(uploadId);
        // console.log('🏁 All chunks completed, starting finalization for upload:', uploadId);
        
        // Uruchom finalizację w tle (nie blokuj uploadPart)
        this.completeUpload(uploadId).catch(error => {
          console.error('❌ Finalization failed:', error);
          upload.status = 'error';
          upload.errorMessage = error instanceof Error ? error.message : 'Finalization failed';
        }).finally(() => {
          this.completionInProgress.delete(uploadId);
        });
      }

      return part;
    } catch (error) {
      // Sprawdź czy to błąd z powodu pause/abort
      if (error instanceof Error && (
        error.message.includes('paused') || 
        error.message.includes('aborted') ||
        error.message.includes('Upload aborted')
      )) {
        console.log(`⏸️ Part ${partNumber} stopped due to pause/abort`);
        chunkInfo.status = 'pending'; // Przywróć status pending dla pause
        throw error; // Rzuć błąd dalej ale bez dodatkowego logu
      }
      
      chunkInfo.status = 'error';
      throw error;
    }
  }

  /**
   * Finalizuje upload
   */
  async completeUpload(uploadId: string): Promise<void> {
    const upload = this.uploads.get(uploadId);
    if (!upload) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    // Sprawdź czy upload już nie został zakończony
    if (upload.status === 'completed') {
      console.log('✅ Upload already completed, skipping:', uploadId);
      return;
    }

    console.log('🚀 Starting finalization for upload:', uploadId);

    try {
      // Finalizuj na R2
      await this.finalizeUploadOnR2(upload);
      
      upload.status = 'completed';
      upload.progress = 100;
      upload.updatedAt = new Date();
      
      console.log('🎉 Upload finalized successfully:', {
        uploadId,
        fileName: upload.fileName,
        fileSize: upload.fileSize,
        parts: upload.parts.length
      });

      // Rejestruj w systemie
      await this.recordUploadInSystem(upload);
      
      console.log('📝 Upload recorded in system:', uploadId);
      
      // Aktualizuj handle i wywołaj callback
      const handle = this.uploadHandles.get(uploadId);
      if (handle) {
        handle.status = 'completed';
        handle.progress = 100;
        handle.bytesUploaded = upload.bytesUploaded;
        handle.parts = [...upload.parts];
        
        // Wywołaj callback completion
        handle.onComplete?.();
      }
      
    } catch (error) {
      // Sprawdź czy to wygasły upload ID
      if (error instanceof Error && error.message === 'UPLOAD_EXPIRED') {
        console.log('⚠️ Upload expired during finalization, marking as completed anyway:', uploadId);
        upload.status = 'completed';
        upload.progress = 100;
        upload.updatedAt = new Date();
        
        // Spróbuj zapisać w systemie mimo wygasłego R2 upload
        try {
          await this.recordUploadInSystem(upload);
          console.log('📝 Upload recorded in system despite R2 expiration:', uploadId);
        } catch (recordError) {
          console.error('❌ Failed to record expired upload:', recordError);
        }
        return;
      }
      
      upload.status = 'error';
      upload.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      upload.updatedAt = new Date();
      throw error;
    }
  }

  /**
   * Finalizuje upload (alias dla completeUpload)
   */
  async finalizeUpload(uploadId: string): Promise<void> {
    return this.completeUpload(uploadId);
  }

  /**
   * Anuluje upload
   */
  async abortUpload(uploadId: string): Promise<void> {
    const upload = this.uploads.get(uploadId);
    if (!upload) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    // console.log(`🛑 Aborting upload: ${uploadId}`);

    // Anuluj aktywne requests XMLHttpRequest
    const requests = this.activeRequests.get(uploadId);
    if (requests) {
      for (const [, xhr] of requests) {
        // console.log(`🛑 Aborting active request for chunk ${partNumber}`);
        xhr.abort();
      }
      requests.clear();
    }

    try {
      // Anuluj na R2
      if (upload.uploadId) {
        await this.abortUploadOnR2(upload);
      }
      
      upload.status = 'aborted';
      upload.updatedAt = new Date();
      
      // Aktualizuj handle
      const handle = this.uploadHandles.get(uploadId);
      if (handle) {
        handle.status = 'aborted';
        handle.onStatusChange?.('aborted');
        handle.onError?.('Upload został anulowany');
      }
      
      // Wyczyść chunki
      this.chunkInfo.delete(uploadId);
      this.activeChunks.delete(uploadId);
      this.activeRequests.delete(uploadId);
      this.retryCounts.delete(uploadId);
      this.completionInProgress.delete(uploadId);
      
    } catch (error) {
      console.error('Error aborting upload:', error);
      // Nawet jeśli abort na R2 się nie uda, usuń upload lokalnie
      this.chunkInfo.delete(uploadId);
      this.activeChunks.delete(uploadId);
      this.activeRequests.delete(uploadId);
      this.retryCounts.delete(uploadId);
      this.completionInProgress.delete(uploadId);
    }
  }

  /**
   * Wstrzymuje upload
   */
  async pauseUpload(uploadId: string): Promise<void> {
    const upload = this.uploads.get(uploadId);
    if (!upload) {
      // console.log(`Upload ${uploadId} not found, cannot pause`);
      return;
    }

    if (upload.status !== 'uploading') {
      // console.log(`Upload ${uploadId} is not uploading, cannot pause (status: ${upload.status})`);
      return;
    }

    // console.log(`⏸️ Pausing upload: ${uploadId}`);
    
    // Anuluj aktywne requests XMLHttpRequest
    const requests = this.activeRequests.get(uploadId);
    if (requests) {
      for (const [, xhr] of requests) {
        // console.log(`🛑 Aborting active request for chunk ${partNumber}`);
        xhr.abort();
      }
      requests.clear();
    }
    
    // Oczyść activeChunks - chunki nie są już aktywnie uploadowane
    const activeChunks = this.activeChunks.get(uploadId);
    if (activeChunks) {
      for (const partNumber of activeChunks) {
        // console.log(`🔄 Marking chunk ${partNumber} as pending for resume`);
        // Oznacz chunk jako pending żeby mógł być wznowiony
        const chunks = this.chunkInfo.get(uploadId);
        const chunkInfo = chunks?.find(c => c.partNumber === partNumber);
        if (chunkInfo && chunkInfo.status === 'uploading') {
          chunkInfo.status = 'pending';
          chunkInfo.uploadedBytes = 0; // Reset progress dla chunk'a który zostaje wznowiony
        }
      }
      activeChunks.clear();
    }
    
    upload.status = 'paused';
    upload.updatedAt = new Date();

    // Aktualizuj handle
    const handle = this.uploadHandles.get(uploadId);
    if (handle) {
      handle.status = 'paused';
      handle.onStatusChange?.('paused');
    }
  }

  /**
   * Synchronizuje stan ukończonych części z serwerem
   */
  private async syncCompletedPartsFromServer(uploadId: string): Promise<void> {
    const upload = this.uploads.get(uploadId);
    if (!upload || !upload.uploadId) {
      throw new Error(`Upload ${uploadId} not found or no multipart upload ID`);
    }

    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('No auth token');

    // Pobierz listę ukończonych części z serwera
    const response = await fetch(`/api/files/multipart/list-parts?uploadId=${upload.uploadId}&key=${upload.key}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to list parts: ${response.statusText}`);
    }

    const { parts } = await response.json();
    // console.log(`🔍 Server has ${parts.length} completed parts for upload ${uploadId}`);

    // Aktualizuj stan chunków na podstawie danych z serwera
    const chunks = this.chunkInfo.get(uploadId);
    if (chunks) {
      for (const chunk of chunks) {
        const serverPart = parts.find((p: Part) => p.partNumber === chunk.partNumber);
        if (serverPart) {
          // Chunk jest ukończony na serwerze
          chunk.status = 'completed';
          chunk.uploadedBytes = chunk.size;
          
          // Dodaj do upload.parts jeśli nie ma
          const existingPartIndex = upload.parts.findIndex(p => p.partNumber === chunk.partNumber);
          if (existingPartIndex === -1) {
            upload.parts.push({
              partNumber: chunk.partNumber,
              etag: serverPart.etag,
              size: chunk.size,
              uploadedAt: new Date(serverPart.uploadedAt),
              status: 'completed'
            });
          }
          
          console.log(`✅ Chunk ${chunk.partNumber} confirmed completed on server`);
        } else if (chunk.status === 'completed') {
          // Chunk oznaczony jako completed lokalnie ale nie ma go na serwerze
          chunk.status = 'pending';
          chunk.uploadedBytes = 0;
          console.log(`🔄 Chunk ${chunk.partNumber} needs re-upload (not on server)`);
        }
      }
    }

    // Przelicz bytesUploaded na podstawie faktycznych ukończonych chunków
    const completedChunks = chunks?.filter(c => c.status === 'completed') || [];
    upload.bytesUploaded = completedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
    upload.progress = Math.round((upload.bytesUploaded / upload.fileSize) * 100);
    
    // console.log(`📊 Updated progress: ${upload.bytesUploaded}/${upload.fileSize} bytes (${upload.progress}%)`);
  }

  /**
   * Wznawia upload
   */
  async resumeUpload(uploadId: string): Promise<void> {
    const upload = this.uploads.get(uploadId);
    if (!upload) {
      // console.log(`Upload ${uploadId} not found, cannot resume`);
      return;
    }

    if (upload.status !== 'paused') {
      // console.log(`Upload ${uploadId} is not paused, cannot resume (status: ${upload.status})`);
      return;
    }

    // console.log(`▶️ Resuming upload: ${uploadId} - checking server state...`);

    // Sprawdź które części są faktycznie ukończone na serwerze
    try {
      await this.syncCompletedPartsFromServer(uploadId);
    } catch (error) {
      console.error('Failed to sync completed parts from server:', error);
      // Kontynuuj mimo błędu - może server error
    }

    const chunks = this.chunkInfo.get(uploadId);
    if (chunks) {
      // Zredukowano szczegółowe logi resume - zmienne usunięte
    }
    
    upload.status = 'uploading';
    upload.updatedAt = new Date();

    // Aktualizuj handle
    const handle = this.uploadHandles.get(uploadId);
    if (handle) {
      handle.status = 'uploading';
      handle.onStatusChange?.('uploading');
    }

    // Wznów upload chunków które nie zostały ukończone
    this.startChunkUploads(uploadId);
  }

  /**
   * Usuwa upload z managera (bez anulowania na R2)
   */
  removeUpload(uploadId: string): void {
    console.log(`🗑️ Removing upload from manager: ${uploadId}`);
    
    this.uploads.delete(uploadId);
    this.uploadHandles.delete(uploadId);
    this.chunkInfo.delete(uploadId);
    this.activeChunks.delete(uploadId);
    this.retryCounts.delete(uploadId);
    this.completionInProgress.delete(uploadId);
  }

  /**
   * Pobiera status upload'u
   */
  getUploadStatus(uploadId: string): MultipartUploadState | undefined {
    return this.uploads.get(uploadId);
  }

  /**
   * Pobiera wszystkie aktywne upload'y
   */
  getAllUploads(): MultipartUploadState[] {
    return Array.from(this.uploads.values());
  }

  /**
   * Pobiera statystyki upload'u
   */
  getUploadStats(uploadId: string): MultipartUploadStats | null {
    const upload = this.uploads.get(uploadId);
    if (!upload) return null;

    const chunks = this.chunkInfo.get(uploadId) || [];
    const completedParts = chunks.filter(c => c.status === 'completed').length;
    const failedParts = chunks.filter(c => c.status === 'error').length;

    return {
      totalParts: chunks.length,
      completedParts,
      failedParts,
      totalBytes: upload.fileSize,
      uploadedBytes: upload.bytesUploaded,
      averageSpeed: upload.speed,
      estimatedTimeRemaining: upload.etaSec
    };
  }

  /**
   * Inteligentnie oblicza optymalny rozmiar chunków na podstawie rozmiaru pliku
   * Używa zaawansowanego algorytmu optymalizacji z pełną walidacją limitów R2
   */
  private calculateOptimalChunks(file: File): ChunkInfo[] {
    const fileSize = file.size;
    
    // Walidacja rozmiaru pliku
    const validation = validateFileSize(fileSize);
    if (!validation.isValid) {
      throw new Error(validation.error || 'Invalid file size');
    }
    
    // Sprawdź czy potrzebujemy multipart upload
    if (!shouldUseMultipart(fileSize)) {
      // Plik < 5MB - używaj simple upload
      throw new Error('File too small for multipart upload. Use simple upload instead.');
    }
    
    // Użyj algorytmu optymalizacji
    const optimization = optimizeChunks(fileSize);
    
    // Debug log z detalami optymalizacji
    logOptimizationDetails(fileSize, optimization);
    
    // Tworzenie chunków na podstawie obliczonego rozmiaru
    const chunks: ChunkInfo[] = [];
    let offset = 0;
    let partNumber = 1;

    while (offset < fileSize && partNumber <= optimization.numChunks) {
      const endByte = Math.min(offset + optimization.chunkSize, fileSize);
      const actualSize = endByte - offset;
      
      chunks.push({
        partNumber,
        startByte: offset,
        endByte,
        size: actualSize,
        status: 'pending',
        uploadedBytes: 0
      });
      
      offset = endByte;
      partNumber++;
    }
    
    // Aktualizuj opcje na podstawie rekomendacji
    this.options.maxConcurrentChunks = optimization.metadata.concurrencyRecommendation;
    
    // Zredukowano logi - tylko kluczowe błędy
    // console.log(`🎯 Chunking completed: ${chunks.length} chunks, concurrency: ${this.options.maxConcurrentChunks}`);
    
    return chunks;
  }

  /**
   * Pobiera chunk z pliku
   */
  private async getFileChunk(uploadId: string, startByte: number, endByte: number): Promise<Blob | null> {
    const upload = this.uploads.get(uploadId);
    if (!upload?.file) return null;

    return upload.file.slice(startByte, endByte);
  }

  /**
   * Inicjuje multipart upload na R2
   */
  private async initiateUploadOnR2(upload: MultipartUploadState): Promise<string> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('No auth token');

    const requestBody = {
      fileName: upload.fileName,
      fileSize: upload.fileSize,
      key: upload.key,
      contentType: upload.file?.type || 'application/octet-stream',
      folder: upload.folder,
      subPath: upload.subPath
    };

    const response = await fetch('/api/files/multipart/create', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to initiate multipart upload');
    }

    const result = await response.json();
    return result.uploadId;
  }

  /**
   * Pobiera presigned URL dla części
   */
  private async getPresignedUrlForPart(upload: MultipartUploadState, partNumber: number): Promise<string> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('No auth token');

    const response = await fetch('/api/files/multipart/sign-part', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uploadId: upload.uploadId,
        partNumber,
        key: upload.key
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || 'Failed to get presigned URL');
    }

    const result = await response.json();
    return result.presignedUrl;
  }

  /**
   * Uploaduje chunk do R2 z progress tracking
   */
  private async uploadChunkToR2(presignedUrl: string, chunk: Blob, uploadId: string, partNumber: number): Promise<string> {
    return new Promise((resolve, reject) => {
      // Sprawdź status przed rozpoczęciem uploadu
      const upload = this.uploads.get(uploadId);
      if (!upload || upload.status === 'paused' || upload.status === 'aborted') {
        reject(new Error(`Upload ${uploadId} is ${upload?.status || 'not found'}`));
        return;
      }

      const xhr = new XMLHttpRequest();
      
      // Dodaj request do trackingu aktywnych requestów
      if (!this.activeRequests.has(uploadId)) {
        this.activeRequests.set(uploadId, new Map());
      }
      this.activeRequests.get(uploadId)!.set(partNumber, xhr);
      
      // Progress tracking
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const currentUpload = this.uploads.get(uploadId);
          const handle = this.uploadHandles.get(uploadId);
          
          // Sprawdź czy upload nie został wstrzymany/anulowany podczas uploadu
          if (!currentUpload || currentUpload.status === 'paused' || currentUpload.status === 'aborted') {
            xhr.abort();
            return;
          }
          
          if (currentUpload && handle) {
            // Zaktualizuj bytesUploaded dla tego chunku
            const chunks = this.chunkInfo.get(uploadId);
            if (chunks) {
              const chunkInfo = chunks.find(c => c.partNumber === partNumber);
              if (chunkInfo) {
                chunkInfo.uploadedBytes = event.loaded;
                
                // Oblicz całkowity progress
                const totalUploadedBytes = chunks.reduce((sum, c) => sum + (c.uploadedBytes || 0), 0);
                const totalProgress = Math.round((totalUploadedBytes / currentUpload.fileSize) * 100);
                
                currentUpload.progress = totalProgress;
                currentUpload.bytesUploaded = totalUploadedBytes;
                currentUpload.updatedAt = new Date();
                
                // Aktualizuj handle
                handle.progress = totalProgress;
                handle.bytesUploaded = totalUploadedBytes;
                
                // Wywołaj callback progress
                handle.onProgress?.(totalProgress, totalUploadedBytes, currentUpload.speed);
              }
            }
          }
        }
      });
      
      xhr.addEventListener('load', () => {
        // Usuń request z trackingu
        this.activeRequests.get(uploadId)?.delete(partNumber);
        
        if (xhr.status !== 200) {
          console.error(`❌ Upload failed:`, {
            status: xhr.status,
            statusText: xhr.statusText
          });
          reject(new Error(`Failed to upload chunk: ${xhr.status} ${xhr.statusText}`));
          return;
        }

        const etag = xhr.getResponseHeader('ETag');
        if (!etag) {
          console.error(`❌ No ETag in response headers`);
          reject(new Error('No ETag received from R2'));
          return;
        }

        resolve(etag.replace(/"/g, '')); // Remove quotes from ETag
      });
      
      xhr.addEventListener('error', () => {
        // Usuń request z trackingu
        this.activeRequests.get(uploadId)?.delete(partNumber);
        console.error(`❌ Network error during upload`);
        reject(new Error('Network error during upload'));
      });
      
      xhr.addEventListener('abort', () => {
        // Usuń request z trackingu
        this.activeRequests.get(uploadId)?.delete(partNumber);
        console.log(`⏸️ Upload chunk ${partNumber} aborted`);
        reject(new Error('Upload aborted'));
      });
      
      xhr.open('PUT', presignedUrl);
      xhr.setRequestHeader('Content-Type', 'application/octet-stream');
      xhr.send(chunk);
    });
  }

  /**
   * Finalizuje upload na R2
   */
  private async finalizeUploadOnR2(upload: MultipartUploadState): Promise<void> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('No auth token');

    // Sprawdź czy wszystkie parts są ukończone
    const completedParts = upload.parts.filter(p => p.status === 'completed');
    if (completedParts.length === 0) {
      throw new Error('No completed parts to finalize');
    }

    console.log('🔧 Finalizing upload:', {
      uploadId: upload.uploadId,
      totalParts: upload.parts.length,
      completedParts: completedParts.length,
      fileName: upload.fileName
    });

    // Sortuj parts
    const sortedParts = completedParts.sort((a, b) => a.partNumber - b.partNumber);
    
    // Waliduj sekwencję
    const expectedParts = sortedParts.length;
    const partNumbers = sortedParts.map(p => p.partNumber);
    const expectedSequence = Array.from({ length: expectedParts }, (_, i) => i + 1);
    
    console.log('🔧 Part validation:', {
      expectedSequence,
      actualSequence: partNumbers,
      isValid: JSON.stringify(expectedSequence) === JSON.stringify(partNumbers)
    });
    
    console.log('🔧 Finalizing upload with sorted parts:', sortedParts.map(p => ({ partNumber: p.partNumber, etag: p.etag })));

    const response = await fetch('/api/files/multipart/complete', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        uploadId: upload.uploadId,
        key: upload.key,
        parts: sortedParts
      })
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      
      // Jeśli upload wygasł, wyczyść stan i pozwól na restart
      if (response.status === 410 && error.code === 'UPLOAD_NOT_FOUND') {
        console.warn('⚠️ Upload session expired, cleaning up state:', upload.uploadId);
        this.uploads.delete(upload.uploadId);
        this.activeChunks.delete(upload.uploadId);
        this.completionInProgress.delete(upload.uploadId);
        
        // Oznacz upload jako error żeby system mógł go zrestartować
        upload.status = 'error';
        upload.errorMessage = 'Upload session expired. Starting new upload...';
        
        throw new Error('UPLOAD_EXPIRED'); // Specjalny błąd dla restart logic
      }
      
      console.error('❌ Complete upload failed:', {
        status: response.status,
        error: error.error || 'Unknown error',
        details: error.details
      });
      
      throw new Error(error.error || 'Failed to finalize multipart upload');
    }
  }

  /**
   * Anuluje upload na R2
   */
  private async abortUploadOnR2(upload: MultipartUploadState): Promise<void> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('No auth token');

    try {
      await fetch('/api/files/multipart/abort', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          uploadId: upload.uploadId,
          key: upload.key
        })
      });
    } catch (error) {
      console.error('Error aborting upload on R2:', error);
      throw error;
    }
  }

  /**
   * Rejestruje upload w systemie
   */
  private async recordUploadInSystem(upload: MultipartUploadState): Promise<void> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('No auth token');

    try {
      const requestBody = {
        fileName: upload.fileName,
        fileSize: upload.fileSize,
        key: upload.key,
        contentType: upload.file?.type || 'application/octet-stream',
        folder: upload.folder,
        subPath: upload.subPath,
        uploadMethod: 'multipart'
      };

      const response = await fetch('/api/files/upload-record', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.error || 'Failed to record upload');
      }
    } catch (error) {
      console.error('Error recording upload:', error);
      throw error;
    }
  }

  /**
   * Próbuje uruchomić kolejny chunk jeśli są pending i nie przekroczono limitu concurrent
   */
  private tryStartNextChunk(uploadId: string): void {
    const upload = this.uploads.get(uploadId);
    const chunks = this.chunkInfo.get(uploadId);
    
    if (!upload || !chunks) return;
    
    // Sprawdź czy upload jest aktywny
    if (upload.status !== 'uploading') return;
    
    // Sprawdź ile chunków jest aktywnie uploadowanych
    const activeCount = this.activeChunks.get(uploadId)?.size || 0;
    const maxConcurrent = this.options.maxConcurrentChunks || 3;
    
    if (activeCount >= maxConcurrent) {
      console.log(`⏭️ Max concurrent chunks reached (${activeCount}/${maxConcurrent}), waiting...`);
      return;
    }
    
    // Znajdź pierwszy pending chunk
    const nextPendingChunk = chunks.find(chunk => 
      chunk.status === 'pending' || chunk.status === 'error'
    );
    
    if (nextPendingChunk) {
      // console.log(`🚀 Starting next chunk ${nextPendingChunk.partNumber} (${activeCount + 1}/${maxConcurrent})`);
      this.uploadChunk(uploadId, nextPendingChunk.partNumber);
    } else {
      // console.log(`✅ No more chunks to upload for ${uploadId}`);
    }
  }

  /**
   * Rozpoczyna upload chunków
   */
  private async startChunkUploads(uploadId: string): Promise<void> {
    const upload = this.uploads.get(uploadId);
    const chunks = this.chunkInfo.get(uploadId);
    
    if (!upload || !chunks) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    // Znajdź chunki które potrzebują uploadu (pending lub error)
    const pendingChunks = chunks.filter(chunk => 
      chunk.status === 'pending' || chunk.status === 'error'
    );

    // Zredukowano logi
    // console.log(`🔄 Starting chunk uploads: ${pendingChunks.length} chunks need upload`);

    // Rozpocznij upload chunków (ograniczenie do maxConcurrentChunks)
    const maxConcurrent = this.options.maxConcurrentChunks || 3;
    const chunksToUpload = pendingChunks.slice(0, maxConcurrent);

    // Upload chunków równolegle
    for (const chunk of chunksToUpload) {
      // console.log(`🚀 Starting upload for chunk ${chunk.partNumber}`);
      this.uploadChunk(uploadId, chunk.partNumber);
    }
  }

  /**
   * Uploaduje pojedynczy chunk
   */
  async uploadChunk(uploadId: string, partNumber: number): Promise<void> {
    const upload = this.uploads.get(uploadId);
    const chunks = this.chunkInfo.get(uploadId);
    
    if (!upload || !chunks) {
      throw new Error(`Upload ${uploadId} not found`);
    }

    // Sprawdź czy upload nie został wstrzymany lub anulowany
    if (upload.status === 'paused') {
      console.log(`⏸️ Upload ${uploadId} is paused, stopping chunk ${partNumber}`);
      return;
    }
    
    if (upload.status === 'aborted') {
      console.log(`🛑 Upload ${uploadId} is aborted, stopping chunk ${partNumber}`);
      return;
    }

    const chunkInfo = chunks.find(c => c.partNumber === partNumber);
    if (!chunkInfo) {
      throw new Error(`Chunk ${partNumber} not found`);
    }

    // Sprawdź czy chunk już jest ukończony
    if (chunkInfo.status === 'completed') {
      console.log(`✅ Chunk ${partNumber} already completed, skipping`);
      return;
    }

    // Sprawdź czy chunk już nie jest w trakcie upload'u (ale pozwól na pending chunks po pause)
    if (this.activeChunks.get(uploadId)?.has(partNumber) && chunkInfo.status === 'uploading') {
      console.log(`⏭️ Chunk ${partNumber} already uploading, skipping`);
      return;
    }

    this.activeChunks.get(uploadId)?.add(partNumber);
    chunkInfo.status = 'uploading';

    try {
      // Pobierz chunk z pliku
      const chunk = await this.getFileChunk(uploadId, chunkInfo.startByte, chunkInfo.endByte);
      if (chunk) {
        // Upload part
        await this.uploadPart(uploadId, partNumber, chunk);
        
        // Oznacz chunk jako completed
        chunkInfo.status = 'completed';
        
        // **WAŻNE: Uruchom kolejny chunk jeśli są jeszcze pending**
        this.tryStartNextChunk(uploadId);
        
        // Finalizacja jest obsługiwana w głównej ścieżce (uploadPart)
        console.log('✅ Chunk completed via retry path, finalization handled elsewhere');
        
      } else {
        throw new Error(`Failed to create chunk blob for part ${partNumber}`);
      }
    } catch (error) {
      // Sprawdź czy to błąd z powodu pause/abort NAJPIERW
      if (error instanceof Error && (
        error.message.includes('paused') || 
        error.message.includes('aborted') ||
        error.message.includes('Upload aborted')
      )) {
        console.log(`⏸️ Chunk ${partNumber} stopped due to pause/abort`);
        chunkInfo.status = 'pending'; // Przywróć status pending dla pause
        return; // Nie rzucaj błędu dla pause/abort
      }
      
      // Sprawdź czy to wygasły upload ID
      if (error instanceof Error && error.message === 'UPLOAD_EXPIRED') {
        console.log(`🔄 Upload expired for chunk ${partNumber}, will need to restart entire upload`);
        upload.status = 'error';
        upload.errorMessage = 'Upload session expired. Please restart the upload.';
        upload.updatedAt = new Date();
        return; // Nie próbuj retry ze starym upload ID
      }
      
      // TYLKO TERAZ loguj jako error dla prawdziwych błędów
      console.error(`Error uploading chunk ${partNumber}:`, error);
      
      // Oznacz chunk jako error
      chunkInfo.status = 'error';
      
      // Spróbuj retry dla innych błędów
      if (this.shouldRetryChunk(uploadId, partNumber)) {
        console.log(`Retrying chunk ${partNumber}...`);
        // Pobierz chunk ponownie
        const chunk = await this.getFileChunk(uploadId, chunkInfo.startByte, chunkInfo.endByte);
        if (chunk) {
          await this.retryChunkUpload(uploadId, partNumber, chunk);
        }
      } else {
        // Przekroczono limit retry - oznacz upload jako błąd
        upload.status = 'error';
        upload.errorMessage = `Chunk ${partNumber} failed after retries: ${error instanceof Error ? error.message : 'Unknown error'}`;
        upload.updatedAt = new Date();
      }
    } finally {
      // Zawsze usuń chunk z activeChunks na koniec
      this.activeChunks.get(uploadId)?.delete(partNumber);
    }
  }

  /**
   * Sprawdza czy chunk powinien być retry
   */
  private shouldRetryChunk(uploadId: string, partNumber: number): boolean {
    const retryCounts = this.retryCounts.get(uploadId) || new Map();
    const currentRetries = retryCounts.get(partNumber) || 0;
    return currentRetries < (this.options.retryAttempts || 3);
  }

  /**
   * Retry upload chunk'a
   */
  private async retryChunkUpload(uploadId: string, partNumber: number, chunk: Blob): Promise<void> {
    const retryCounts = this.retryCounts.get(uploadId) || new Map();
    const currentRetries = retryCounts.get(partNumber) || 0;
    const newRetryCount = currentRetries + 1;

    // Aktualizuj licznik retry
    retryCounts.set(partNumber, newRetryCount);
    this.retryCounts.set(uploadId, retryCounts);

    const delay = this.options.retryDelay! * Math.pow(2, currentRetries); // Exponential backoff
    console.log(`Retrying chunk ${partNumber} in ${delay}ms (attempt ${newRetryCount}/${this.options.retryAttempts})`);

    await new Promise(resolve => setTimeout(resolve, delay));

    try {
      await this.uploadPart(uploadId, partNumber, chunk);
      console.log(`✅ Retry ${newRetryCount} succeeded for chunk ${partNumber}`);
    } catch (error) {
      // Sprawdź czy to błąd z powodu pause/abort
      if (error instanceof Error && (
        error.message.includes('paused') || 
        error.message.includes('aborted') ||
        error.message.includes('Upload aborted')
      )) {
        console.log(`⏸️ Retry ${newRetryCount} stopped due to pause/abort for chunk ${partNumber}`);
        throw error; // Rzuć błąd dalej ale bez dodatkowego logu
      }
      
      console.log(`❌ Retry ${newRetryCount} failed for chunk ${partNumber}`);
      
      if (newRetryCount < (this.options.retryAttempts || 3)) {
        // Kolejny retry
        await this.retryChunkUpload(uploadId, partNumber, chunk);
      } else {
        // Max retries exceeded
        const upload = this.uploads.get(uploadId);
        if (upload) {
          upload.status = 'error';
          upload.errorMessage = `Chunk ${partNumber} failed after ${newRetryCount} attempts`;
          upload.updatedAt = new Date();
        }
      }

      throw error;
    }
  }

  /**
   * Sprawdza czy wszystkie chunki są ukończone
   */
  private areAllChunksCompleted(uploadId: string): boolean {
    const chunks = this.chunkInfo.get(uploadId);
    if (!chunks) return false;

    return chunks.every(c => c.status === 'completed');
  }

  /**
   * Oblicza progress upload'u
   */
  private calculateProgress(upload: MultipartUploadState): number {
    const chunks = this.chunkInfo.get(upload.id);
    if (!chunks || chunks.length === 0) return 0;

    const completedChunks = chunks.filter(c => c.status === 'completed');
    const completedBytes = completedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
    
    return Math.round((completedBytes / upload.fileSize) * 100);
  }

  /**
   * Aktualizuje statystyki prędkości
   */
  private updateSpeedStats(upload: MultipartUploadState): void {
    const chunks = this.chunkInfo.get(upload.id);
    if (!chunks) return;

    const completedChunks = chunks.filter(c => c.status === 'completed');
    
    if (completedChunks.length === 0) {
      upload.speed = 0;
      upload.etaSec = null;
      return;
    }

    const totalBytes = chunks.reduce((sum, chunk) => sum + chunk.size, 0);
    const uploadedBytes = completedChunks.reduce((sum, chunk) => sum + chunk.size, 0);
    
    const elapsedMs = new Date().getTime() - upload.createdAt.getTime();
    const elapsedSec = elapsedMs / 1000;
    
    if (elapsedSec > 0) {
      upload.speed = (uploadedBytes / (1024 * 1024)) / elapsedSec; // MB/s
      
      const remainingBytes = totalBytes - uploadedBytes;
      if (upload.speed > 0) {
        upload.etaSec = Math.round(remainingBytes / (upload.speed * 1024 * 1024));
      }
    }
  }
}

// Export singleton instance
export const multipartUploadManager = new MultipartUploadManager();
