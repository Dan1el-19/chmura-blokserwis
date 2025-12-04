import Uppy, { UppyFile } from "@uppy/core";
import Dashboard from "@uppy/dashboard";
import AwsS3 from "@uppy/aws-s3";
import GoldenRetriever from "@uppy/golden-retriever";
import { auth } from "@/lib/firebase";
import { MultipartUploadState, MultipartUploadStatus } from "@/types/multipart";

interface UploadOpts {
  uploadId?: string;
  key?: string;
  partNumber?: number;
  parts?: Array<{ ETag?: string | undefined; PartNumber?: number | undefined }>;
  signal?: AbortSignal;
}

export interface UppyMultipartCallbacks {
  onProgress?: (progress: number, bytesUploaded: number, speed: number) => void;
  onStatusChange?: (status: MultipartUploadStatus) => void;
  onError?: (error: string) => void;
  onComplete?: () => void;
  onStarted?: () => void;
  onPaused?: () => void;
  onResumed?: () => void;
}

export interface UppyMultipartHandle {
  id: string;
  uppy: Uppy;
  status: MultipartUploadStatus;
  progress: number;
  bytesUploaded: number;
  speed: number;
  fileName: string;
  fileSize: number;

  // Actions
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  destroy: () => void;
}

export class UppyMultipartEngine {
  private uppyInstance: Uppy | null = null;
  private dashboard: Dashboard<
    Record<string, unknown>,
    Record<string, unknown>
  > | null = null;
  private currentUpload: MultipartUploadState | null = null;
  private callbacks: UppyMultipartCallbacks = {};
  private initialized: boolean = false;

  constructor(
    private options: {
      target?: string | HTMLElement;
      inline?: boolean;
      height?: number | string;
      width?: number | string;
      showProgressDetails?: boolean;
      proudlyDisplayPoweredByUppy?: boolean;
      showRemoveButton?: boolean;
    } = {}
  ) {
    this.options = {
      inline: true,
      height: 400,
      width: "100%",
      showProgressDetails: true,
      proudlyDisplayPoweredByUppy: false,
      showRemoveButton: true,
      ...this.options,
    };
  }

  /**
   * Inicjalizuje Uppy z plikiem (dopiero po potwierdzeniu)
   */
  async initializeUppy(
    file: File,
    folder: "personal" | "main",
    subPath?: string
  ): Promise<Uppy> {
    if (this.initialized) {
      throw new Error("Uppy is already initialized");
    }

    // Stwórz instancję Uppy
    this.uppyInstance = new Uppy({
      autoProceed: false,
      allowMultipleUploads: false,
      debug: false,
      restrictions: {
        maxFileSize: null,
        allowedFileTypes: null,
      },
    });

    // Skonfiguruj AWS S3 plugin dla multipart
    this.uppyInstance.use(AwsS3, {
      createMultipartUpload: (
        file: UppyFile<Record<string, unknown>, Record<string, unknown>>
      ) => this.createMultipartUpload(file, folder, subPath),
      listParts: (
        file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
        opts: UploadOpts
      ) => this.listParts(file, opts.uploadId, opts.key),
      abortMultipartUpload: (
        file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
        opts: UploadOpts
      ) => this.abortMultipartUpload(file, opts.uploadId, opts.key),
      completeMultipartUpload: (
        file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
        opts: UploadOpts
      ) =>
        this.completeMultipartUpload(
          file,
          opts.uploadId || "",
          opts.key || "",
          opts.parts || []
        ),
      signPart: (
        file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
        opts: UploadOpts
      ) =>
        this.signPart(
          file,
          opts.uploadId || "",
          opts.key || "",
          opts.partNumber || 1
        ),
    });

    // Skonfiguruj Golden Retriever dla resume capability
    this.uppyInstance.use(GoldenRetriever, {
      expires: 24 * 60 * 60 * 1000, // 24 godziny
    });

    // Dodaj plik do Uppy
    this.uppyInstance.addFile({
      name: file.name,
      type: file.type,
      data: file,
      size: file.size,
      source: "local",
    });

    // Event listeners
    this.setupEventListeners();

    this.initialized = true;
    return this.uppyInstance;
  }

  /**
   * Pokazuje Uppy Dashboard
   */
  showDashboard(): void {
    if (!this.initialized || !this.uppyInstance) {
      throw new Error("Uppy is not initialized");
    }

    if (this.dashboard) {
      // Dashboard is already visible
      return;
    }

    // Stwórz dashboard
    this.uppyInstance.use(Dashboard, {
      target: this.options.target || this.createDashboardContainer(),
      height: this.options.height,
      width: this.options.width,
      hideProgressDetails: !this.options.showProgressDetails,
      proudlyDisplayPoweredByUppy: this.options.proudlyDisplayPoweredByUppy,
      doneButtonHandler: () => this.hideDashboard(),
    });

    this.dashboard = this.uppyInstance.getPlugin(
      "Dashboard"
    ) as unknown as Dashboard<
      Record<string, unknown>,
      Record<string, unknown>
    > | null;
  }

  /**
   * Ukrywa Uppy Dashboard
   */
  hideDashboard(): void {
    if (this.dashboard) {
      // Dashboard doesn't have close method, we'll remove it from DOM
      this.dashboard = null;
    }
  }

  /**
   * Automatycznie dodaje plik do Uppy (po potwierdzeniu)
   */
  addFileToUppy(file: File): void {
    if (!this.initialized || !this.uppyInstance) {
      throw new Error("Uppy is not initialized");
    }

    // Usuń poprzedni plik jeśli istnieje
    const files = this.uppyInstance.getFiles();
    if (files.length > 0) {
      this.uppyInstance.removeFile(files[0].id);
    }

    // Dodaj nowy plik
    this.uppyInstance.addFile({
      name: file.name,
      type: file.type,
      data: file,
      size: file.size,
      source: "local",
    });
  }

  /**
   * Ustawia callbacki dla upload events
   */
  setCallbacks(callbacks: UppyMultipartCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Rozpoczyna upload
   */
  startUpload(): void {
    if (!this.initialized || !this.uppyInstance) {
      throw new Error("Uppy is not initialized");
    }

    this.callbacks.onStarted?.();
    this.uppyInstance.upload();
  }

  /**
   * Pauzuje upload
   */
  pauseUpload(): void {
    if (this.uppyInstance) {
      this.uppyInstance.pauseAll();
      this.callbacks.onPaused?.();
    }
  }

  /**
   * Wznawia upload
   */
  resumeUpload(): void {
    if (this.uppyInstance) {
      this.uppyInstance.resumeAll();
      this.callbacks.onResumed?.();
    }
  }

  /**
   * Anuluje upload
   */
  cancelUpload(): void {
    if (this.uppyInstance) {
      this.uppyInstance.cancelAll();
    }
  }

  /**
   * Sprawdza czy Uppy jest zainicjalizowane
   */
  isReady(): boolean {
    return this.initialized;
  }

  /**
   * Pobiera instancję Uppy
   */
  getUppyInstance(): Uppy | null {
    return this.uppyInstance;
  }

  /**
   * Resetuje Uppy (dla nowego uploadu)
   */
  reset(): void {
    if (this.uppyInstance) {
      // Clear all files instead of using reset which might not exist
      const files = this.uppyInstance.getFiles();
      files.forEach((file) => this.uppyInstance?.removeFile(file.id));
    }
    if (this.dashboard) {
      this.dashboard = null;
    }
    this.currentUpload = null;
    this.initialized = false;
  }

  /**
   * Niszczy instancję Uppy
   */
  destroy(): void {
    if (this.uppyInstance) {
      try {
        // Clear all files instead of using reset which might not exist
        const files = this.uppyInstance.getFiles();
        files.forEach((file) => this.uppyInstance?.removeFile(file.id));
      } catch (error) {
        console.warn("Error clearing Uppy files:", error);
      }
      this.uppyInstance = null;
    }
    if (this.dashboard) {
      this.dashboard = null;
    }
    this.currentUpload = null;
    this.initialized = false;
  }

  // Private methods

  // AWS S3 Multipart Upload Methods
  private async createMultipartUpload(
    file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
    folder: "personal" | "main",
    subPath?: string
  ) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("No auth token");
    }

    const response = await fetch("/api/files/multipart/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: file.name || "unknown",
        fileSize: file.size || 0,
        key: file.name || "unknown",
        folder,
        subPath,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to initialize multipart upload");
    }

    const result = await response.json();
    return {
      uploadId: result.uploadId,
      key: result.key,
    };
  }

  private async listParts(
    _file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
    _uploadId: string | undefined,
    _key: string | undefined
  ) {
    // Implementation for listing parts - returning empty array for now
    // In a real implementation, you would fetch existing parts from the server
    return [] as Array<{ ETag: string | undefined; PartNumber: number }>;
  }

  private async abortMultipartUpload(
    file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
    uploadId: string | undefined,
    key: string | undefined
  ): Promise<void> {
    if (!uploadId || !key) {
      throw new Error("Missing uploadId or key");
    }

    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("No auth token");
    }

    const response = await fetch("/api/files/multipart/abort", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uploadId,
        key,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to abort multipart upload");
    }
  }

  private async completeMultipartUpload(
    file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
    uploadId: string,
    key: string,
    parts: Array<{ ETag?: string | undefined; PartNumber?: number | undefined }>
  ): Promise<{ location?: string }> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("No auth token");
    }

    // Filter out parts with undefined PartNumber and convert to expected format
    const validParts = parts
      .filter(
        (part): part is { ETag?: string | undefined; PartNumber: number } =>
          part.PartNumber !== undefined
      )
      .map((part) => ({
        ETag: part.ETag || "",
        PartNumber: part.PartNumber,
      }));

    const response = await fetch("/api/files/multipart/complete", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uploadId,
        key,
        parts: validParts,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to complete multipart upload");
    }

    const result = await response.json();
    return {
      location: result.location,
    };
  }

  private async signPart(
    file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
    uploadId: string,
    key: string,
    partNumber: number
  ) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("No auth token");
    }

    const response = await fetch("/api/files/multipart/sign-part", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        uploadId,
        key,
        partNumber,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to sign part");
    }

    const result = await response.json();
    return {
      url: result.url,
    };
  }

  private createDashboardContainer(): HTMLElement {
    const container = document.createElement("div");
    container.id = "uppy-multipart-dashboard";
    container.style.position = "fixed";
    container.style.top = "50%";
    container.style.left = "50%";
    container.style.transform = "translate(-50%, -50%)";
    container.style.zIndex = "9999";
    container.style.backgroundColor = "white";
    container.style.borderRadius = "8px";
    container.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.15)";
    container.style.padding = "20px";
    container.style.maxWidth = "90vw";
    container.style.maxHeight = "90vh";
    container.style.overflow = "auto";

    // Dodaj przycisk zamknięcia
    const closeButton = document.createElement("button");
    closeButton.innerHTML = "×";
    closeButton.style.position = "absolute";
    closeButton.style.top = "10px";
    closeButton.style.right = "15px";
    closeButton.style.background = "none";
    closeButton.style.border = "none";
    closeButton.style.fontSize = "24px";
    closeButton.style.cursor = "pointer";
    closeButton.style.color = "#666";
    closeButton.onclick = () => this.hideDashboard();

    container.appendChild(closeButton);
    document.body.appendChild(container);

    return container;
  }

  private async getUploadParameters(
    file: UppyFile<Record<string, unknown>, Record<string, unknown>>,
    folder: "personal" | "main",
    subPath?: string
  ): Promise<{
    method?: "PUT";
    url: string;
    fields?: Record<string, never>;
    expires?: number;
    headers?: Record<string, string>;
  }> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) {
      throw new Error("No auth token");
    }

    // Inicjalizuj multipart upload
    const response = await fetch("/api/files/multipart/create", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        key: file.name,
        folder,
        subPath,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || "Failed to initialize multipart upload");
    }

    const result = await response.json();

    // Zapisz informacje o uploadzie
    this.currentUpload = {
      id: result.uploadId,
      uploadId: result.uploadId,
      key: result.key,
      fileName: file.name || "unknown",
      fileSize: file.size || 0,
      folder,
      subPath,
      status: "initializing",
      parts: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      progress: 0,
      bytesUploaded: 0,
      speed: 0,
      etaSec: null,
    };

    return {
      method: "PUT" as const,
      url: result.uploadUrl || "/api/files/multipart/sign-part",
      fields: {},
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    };
  }

  private setupEventListeners(): void {
    if (!this.uppyInstance) return;

    // Progress event
    this.uppyInstance.on("upload-progress", (file, progress) => {
      const bytesUploaded = progress.bytesUploaded;
      const totalBytes = progress.bytesTotal || progress.bytesUploaded;
      const progressPercent =
        totalBytes > 0 ? (bytesUploaded / totalBytes) * 100 : 0;
      const speed =
        progress.bytesUploaded /
        (progress.uploadStarted
          ? (Date.now() - progress.uploadStarted) / 1000
          : 1);

      // Aktualizuj currentUpload
      if (this.currentUpload) {
        this.currentUpload.progress = progressPercent;
        this.currentUpload.bytesUploaded = bytesUploaded;
        this.currentUpload.speed = speed / (1024 * 1024); // Convert to MB/s
        this.currentUpload.status = "uploading";
        this.currentUpload.updatedAt = new Date();
      }

      this.callbacks.onProgress?.(progressPercent, bytesUploaded, speed);
    });

    // Status change events
    this.uppyInstance.on("upload", () => {
      if (this.currentUpload) {
        this.currentUpload.status = "uploading";
        this.currentUpload.updatedAt = new Date();
      }
      this.callbacks.onStatusChange?.("uploading");
    });

    this.uppyInstance.on("complete", () => {
      if (this.currentUpload) {
        this.currentUpload.status = "completed";
        this.currentUpload.progress = 100;
        this.currentUpload.updatedAt = new Date();
      }
      this.callbacks.onStatusChange?.("completed");
      this.callbacks.onComplete?.();
    });

    this.uppyInstance.on("error", (error) => {
      if (this.currentUpload) {
        this.currentUpload.status = "error";
        this.currentUpload.errorMessage = error.message || "Upload failed";
        this.currentUpload.updatedAt = new Date();
      }
      this.callbacks.onStatusChange?.("error");
      this.callbacks.onError?.(error.message || "Upload failed");
    });

    // File events
    this.uppyInstance.on("file-added", () => {
      // console.log('File added to Uppy Multipart:', file.name);
    });

    this.uppyInstance.on("file-removed", () => {
      // console.log('File removed from Uppy Multipart:', file.name);
    });

    // Pause/Resume events
    this.uppyInstance.on("pause-all", () => {
      if (this.currentUpload) {
        this.currentUpload.status = "paused";
        this.currentUpload.updatedAt = new Date();
      }
      this.callbacks.onStatusChange?.("paused");
    });

    this.uppyInstance.on("resume-all", () => {
      if (this.currentUpload) {
        this.currentUpload.status = "uploading";
        this.currentUpload.updatedAt = new Date();
      }
      this.callbacks.onStatusChange?.("uploading");
    });
  }
}

// Singleton instance
let uppyMultipartEngineInstance: UppyMultipartEngine | null = null;

export function getUppyMultipartEngine(options?: {
  target?: string | HTMLElement;
  inline?: boolean;
  height?: number | string;
  width?: number | string;
  showProgressDetails?: boolean;
  proudlyDisplayPoweredByUppy?: boolean;
  showRemoveButton?: boolean;
}): UppyMultipartEngine {
  if (!uppyMultipartEngineInstance) {
    uppyMultipartEngineInstance = new UppyMultipartEngine(options);
  }
  return uppyMultipartEngineInstance;
}

export function destroyUppyMultipartEngine(): void {
  if (uppyMultipartEngineInstance) {
    uppyMultipartEngineInstance.destroy();
    uppyMultipartEngineInstance = null;
  }
}

// Convenience function dla lazy initialization
export async function startUppyMultipartUpload(
  file: File,
  folder: "personal" | "main",
  subPath?: string,
  callbacks?: UppyMultipartCallbacks
): Promise<UppyMultipartHandle> {
  const engine = getUppyMultipartEngine();

  // Ustaw callbacki
  if (callbacks) {
    engine.setCallbacks(callbacks);
  }

  // Inicjalizuj Uppy
  const uppy = await engine.initializeUppy(file, folder, subPath);

  // Dodaj plik
  engine.addFileToUppy(file);

  // Pokaż dashboard
  engine.showDashboard();

  // Stwórz handle
  const handle: UppyMultipartHandle = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
    uppy,
    status: "initializing",
    progress: 0,
    bytesUploaded: 0,
    speed: 0,
    fileName: file.name || "unknown",
    fileSize: file.size || 0,

    pause: () => engine.pauseUpload(),
    resume: () => engine.resumeUpload(),
    cancel: () => engine.cancelUpload(),
    destroy: () => engine.destroy(),
  };

  return handle;
}
