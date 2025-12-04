import { UploadQueueManager, QueueStats } from "./uploadQueue";

export type UploadStatus =
  | "queued"
  | "uploading"
  | "paused"
  | "completed"
  | "error"
  | "canceled";

export interface UploadTaskState {
  id: string;
  file: File;
  fileName: string;
  folder: "personal" | "main";
  subPath?: string;
  size: number;
  uploadedBytes: number;
  speedMbps: number;
  etaSec: number | null;
  status: UploadStatus;
  key?: string;
  errorMessage?: string;
  queuePosition?: number;
  estimatedWaitTime?: number;
  // Płynny progress bar
  smoothProgress?: number; // 0-100, interpolowany
  lastPartUpdateTime?: number;
}

export interface UploadManagerEvents {
  onTaskUpdate?: (task: UploadTaskState) => void;
  onTaskComplete?: (task: UploadTaskState) => void;
  onQueueUpdate?: (stats: QueueStats) => void;
}

export class SimpleUploadManager {
  private readonly events: UploadManagerEvents;
  private readonly getAuthHeader: () => Promise<string | null>;
  private activeTasks: Map<string, UploadTaskState> = new Map();
  private abortControllers: Map<string, AbortController> = new Map();
  private lastSample: Map<string, { time: number; uploadedBytes: number }> =
    new Map();
  private queueManager: UploadQueueManager;
  private smoothProgressTimers: Map<string, NodeJS.Timeout> = new Map();
  // Throttling: map taskId -> lastEmit timestamp to reduce excessive updates
  private lastEmitAt: Map<string, number> = new Map();

  constructor(options: {
    events?: UploadManagerEvents;
    getAuthHeader: () => Promise<string | null>;
    maxConcurrentUploads?: number;
  }) {
    this.events = options.events ?? {};
    this.getAuthHeader = options.getAuthHeader;
    this.queueManager = new UploadQueueManager(
      options.maxConcurrentUploads ?? 2
    );
  }

  /**
   * Oblicza płynny progress na podstawie czasu i prędkości uploadu
   */
  private calculateSmoothProgress(task: UploadTaskState): number {
    // Dla ukończonych uploadów, zwróć 100%
    if (task.status === "completed") {
      return 100;
    }

    // Dla uploadów w trakcie, użyj rzeczywistego postępu
    if (task.status === "uploading") {
      // Oblicz podstawowy progress na podstawie uploadedBytes
      const baseProgress = (task.uploadedBytes / task.size) * 100;
      return Math.min(100, Math.max(0, baseProgress));
    }

    // Dla innych statusów, zwróć podstawowy progress
    return (task.uploadedBytes / task.size) * 100;
  }

  /**
   * Uruchamia timer dla płynnego progress
   */
  private startSmoothProgressTimer(taskId: string): void {
    // Zatrzymaj istniejący timer
    this.stopSmoothProgressTimer(taskId);

    // Uruchom nowy timer
    const timer = setInterval(() => {
      const task = this.activeTasks.get(taskId);
      if (!task) {
        this.stopSmoothProgressTimer(taskId);
        return;
      }

      // Kontynuuj tylko dla aktywnych uploadów
      if (task.status === "uploading") {
        task.smoothProgress = this.calculateSmoothProgress(task);
        this.emitUpdate(task);
      } else {
        // Zatrzymaj timer dla błędów i anulowanych
        this.stopSmoothProgressTimer(taskId);
      }
    }, 100); // Aktualizuj co 100ms

    this.smoothProgressTimers.set(taskId, timer);
  }

  /**
   * Zatrzymuje timer dla płynnego progress
   */
  private stopSmoothProgressTimer(taskId: string): void {
    const timer = this.smoothProgressTimers.get(taskId);
    if (timer) {
      clearInterval(timer);
      this.smoothProgressTimers.delete(taskId);
    }
  }

  public getTasks(): UploadTaskState[] {
    return Array.from(this.activeTasks.values());
  }

  public getQueueStats() {
    return this.queueManager.getQueueStats();
  }

  public async enqueue(
    file: File,
    folder: "personal" | "main",
    subPath?: string
  ): Promise<UploadTaskState> {
    const id = Math.random().toString(36).substr(2, 9);

    // Nowy upload - prosty bez wznawiania
    const task: UploadTaskState = {
      id,
      file,
      fileName: file.name,
      folder,
      subPath,
      size: file.size,
      uploadedBytes: 0,
      speedMbps: 0,
      etaSec: null,
      status: "queued",
      smoothProgress: 0,
      lastPartUpdateTime: Date.now(),
    };

    this.activeTasks.set(id, task);

    // Sprawdź czy można uruchomić
    if (this.queueManager.canStartUpload(id)) {
      await this.startUpload(task);
    } else {
      this.queueManager.addToQueue(id);
      this.updateQueueInfo(task);
    }

    return task;
  }

  public pause(id: string) {
    const task = this.activeTasks.get(id);
    if (task && task.status === "uploading") {
      task.status = "paused";
      this.abortControllers.get(id)?.abort();
      this.stopSmoothProgressTimer(id);
      this.emitUpdate(task);
    }
  }

  public resume(id: string) {
    const task = this.activeTasks.get(id);
    if (task && task.status === "paused") {
      this.startUpload(task);
    }
  }

  public cancel(id: string) {
    const task = this.activeTasks.get(id);
    if (task) {
      task.status = "canceled";
      this.abortControllers.get(id)?.abort();
      this.queueManager.removeFromQueue(id);
      this.stopSmoothProgressTimer(id);
      this.emitUpdate(task);
    }
  }

  public remove(id: string) {
    const task = this.activeTasks.get(id);
    if (task) {
      // Usuń z aktywnych zadań
      this.activeTasks.delete(id);
      this.abortControllers.delete(id);
      // Usuń z kolejki
      this.queueManager.removeFromQueue(id);
      this.stopSmoothProgressTimer(id);
    }
  }

  public pauseAll() {
    this.activeTasks.forEach((_, id) => this.pause(id));
  }

  public resumeAll() {
    this.activeTasks.forEach((task) => {
      if (task.status === "paused") this.resume(task.id);
    });
  }

  public cancelAll() {
    this.activeTasks.forEach((_, id) => this.cancel(id));
  }

  public changePriority(id: string, priority: number) {
    // Simple implementation - change priority in queue
    this.queueManager.changePriority(id, priority);
    const task = this.activeTasks.get(id);
    if (task) {
      this.updateQueueInfo(task);
      this.emitUpdate(task);
    }
  }

  private updateQueueInfo(task: UploadTaskState) {
    const stats = this.queueManager.getQueueStats();
    task.queuePosition = this.queueManager.getQueuePosition(task.id);
    task.estimatedWaitTime = stats.averageWaitTime;
  }

  private emitUpdate(task: UploadTaskState) {
    // Throttle updates to at most one per 250ms per task to avoid spam
    const now = Date.now();
    const lastEmit = this.lastEmitAt.get(task.id) || 0;
    if (now - lastEmit < 250) return;

    this.lastEmitAt.set(task.id, now);
    this.events.onTaskUpdate?.(task);
    this.events.onQueueUpdate?.(this.queueManager.getQueueStats());
  }

  private emitComplete(task: UploadTaskState) {
    this.events.onTaskComplete?.(task);
  }

  private sampleSpeed(task: UploadTaskState) {
    const now = Date.now();
    const prev = this.lastSample.get(task.id);
    if (prev) {
      const timeDiff = (now - prev.time) / 1000; // seconds
      const bytesDiff = task.uploadedBytes - prev.uploadedBytes;
      if (timeDiff > 0) {
        const bytesPerSec = bytesDiff / timeDiff;
        const mbps = (bytesPerSec * 8) / (1024 * 1024); // Convert to Mbps
        task.speedMbps = mbps;

        // Calculate ETA
        const remainingBytes = task.size - task.uploadedBytes;
        if (bytesPerSec > 0) {
          task.etaSec = remainingBytes / bytesPerSec;
        }
      }
    }
    this.lastSample.set(task.id, {
      time: now,
      uploadedBytes: task.uploadedBytes,
    });
  }

  private async startUpload(task: UploadTaskState) {
    try {
      // Sprawdź czy można uruchomić upload
      if (!this.queueManager.canStartUpload(task.id)) {
        this.queueManager.addToQueue(task.id);
        this.updateQueueInfo(task);
        this.emitUpdate(task);
        return;
      }

      // Uruchom upload
      if (!this.queueManager.startUpload(task.id)) {
        return;
      }

      task.status = "uploading";
      this.updateQueueInfo(task);
      this.emitUpdate(task);

      // Prosty upload przez backend
      await this.uploadViaBackend(task);
    } catch (error) {
      task.status = "error";
      task.errorMessage =
        error instanceof Error ? error.message : "Nieznany błąd";
      this.emitUpdate(task);
      throw error;
    }
  }

  private async uploadViaBackend(task: UploadTaskState) {
    // Use XHR for small-file uploads so we can emit progress and speed updates.
    return await new Promise<void>(async (resolve, reject) => {
      if (!task.file) return reject(new Error("Plik niedostępny"));
      task.status = "uploading";
      this.startSmoothProgressTimer(task.id);
      this.emitUpdate(task);

      const authHeader = await this.getAuthHeader();
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/files/upload");
      if (authHeader) xhr.setRequestHeader("Authorization", authHeader);

      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) {
          task.uploadedBytes = ev.loaded;
          task.smoothProgress = (ev.loaded / task.size) * 100;
          // sampleSpeed will compute speedMbps based on previous sample stored in lastSample
          this.sampleSpeed(task);
          this.emitUpdate(task);
        }
      };

      xhr.onload = async () => {
        try {
          if (xhr.status >= 200 && xhr.status < 300) {
            const result = JSON.parse(xhr.responseText || "{}");
            task.status = "completed";
            task.uploadedBytes = task.size;
            task.etaSec = 0;
            task.key = result.key;
            this.stopSmoothProgressTimer(task.id);
            this.emitUpdate(task);
            // Notify completion handlers
            this.emitComplete(task);
            resolve();
          } else {
            const errorData = (() => {
              try {
                return JSON.parse(xhr.responseText || "{}");
              } catch {
                return {};
              }
            })();
            task.status = "error";
            task.errorMessage =
              errorData.error || `Błąd uploadu: ${xhr.status}`;
            this.stopSmoothProgressTimer(task.id);
            this.emitUpdate(task);
            reject(new Error(task.errorMessage));
          }
        } catch (err) {
          this.stopSmoothProgressTimer(task.id);
          reject(err);
        }
      };

      xhr.onerror = () => {
        task.status = "error";
        task.errorMessage = "Błąd sieci podczas uploadu";
        this.stopSmoothProgressTimer(task.id);
        this.emitUpdate(task);
        reject(new Error(task.errorMessage));
      };

      // Prepare form data
      const formData = new FormData();
      formData.append("file", task.file);
      formData.append("folder", task.folder);
      if (task.subPath) formData.append("subPath", task.subPath);

      xhr.send(formData);
    });
  }

  // Compatibility methods (empty implementations)
  public async exportSessions(): Promise<string> {
    return JSON.stringify({ version: "1.0", sessions: [] });
  }

  public async importSessions(): Promise<{
    imported: number;
    errors: string[];
  }> {
    return { imported: 0, errors: ["Import not supported in simple mode"] };
  }

  public async cleanupOldSessions(): Promise<number> {
    return 0; // No sessions to cleanup
  }
}
