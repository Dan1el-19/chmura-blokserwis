import {
  UploadEngineAdapter,
  UnifiedUploadState,
  UppyUploadData,
  SimpleUploadData,
} from "@/types/upload";
import { UploadContextValue } from "@/context/UploadContext";

// Adapter dla Uppy Engine (pliki >50MB)
export class UppyEngineAdapter implements UploadEngineAdapter {
  getProgress(upload: UnifiedUploadState): number {
    // Uppy ma progress w procentach
    return upload.progress;
  }

  getSpeed(upload: UnifiedUploadState): string {
    const uppyData = upload.engineData as UppyUploadData;
    if (uppyData.speedBps && isFinite(uppyData.speedBps)) {
      const mbps = (uppyData.speedBps / (1024 * 1024)).toFixed(2);
      return `${mbps} MB/s`;
    }
    return "—";
  }

  getETA(upload: UnifiedUploadState): string {
    if (upload.etaSec && isFinite(upload.etaSec) && upload.etaSec > 0) {
      if (upload.etaSec < 60) return `${Math.round(upload.etaSec)}s`;
      if (upload.etaSec < 3600) return `${Math.round(upload.etaSec / 60)}min`;
      return `${Math.round(upload.etaSec / 3600)}h`;
    }
    return "—";
  }

  getStatus(upload: UnifiedUploadState): string {
    switch (upload.status) {
      case "uploading":
        return "Wysyłanie...";
      case "paused":
        return "Wstrzymane";
      case "success":
        return "Zakończone";
      case "error":
        return "Błąd";
      case "restored":
        return "Wzniesione";
      default:
        return "Nieznany";
    }
  }

  canPause(upload: UnifiedUploadState): boolean {
    return upload.status === "uploading";
  }

  canResume(upload: UnifiedUploadState): boolean {
    return upload.status === "paused" || upload.status === "restored";
  }

  canCancel(upload: UnifiedUploadState): boolean {
    return ["uploading", "paused", "restored"].includes(upload.status);
  }

  async pause(upload: UnifiedUploadState): Promise<void> {
    const uppyData = upload.engineData as UppyUploadData;
    if (uppyData.handle?.pause) {
      try {
        uppyData.handle.pause();
      } catch (error) {
        console.error("Błąd podczas pauzowania Uppy upload:", error);
      }
    }
  }

  async resume(upload: UnifiedUploadState): Promise<void> {
    const uppyData = upload.engineData as UppyUploadData;
    if (uppyData.handle?.resume) {
      try {
        uppyData.handle.resume();
      } catch (error) {
        console.error("Błąd podczas wznawiania Uppy upload:", error);
      }
    }
  }

  async cancel(upload: UnifiedUploadState): Promise<void> {
    const uppyData = upload.engineData as UppyUploadData;
    if (uppyData.handle?.cancel) {
      try {
        uppyData.handle.cancel();
      } catch (error) {
        console.error("Błąd podczas anulowania Uppy upload:", error);
      }
    }
    if (uppyData.handle?.destroy) {
      try {
        uppyData.handle.destroy();
      } catch (error) {
        console.error("Błąd podczas niszczenia Uppy handle:", error);
      }
    }
  }

  async remove(upload: UnifiedUploadState): Promise<void> {
    // Dla Uppy, remove = cancel + destroy
    await this.cancel(upload);
  }
}

// Adapter dla Simple Upload Engine (pliki <50MB)
export class SimpleEngineAdapter implements UploadEngineAdapter {
  constructor(private uploadContext: UploadContextValue) {}

  getProgress(upload: UnifiedUploadState): number {
    const simpleData = upload.engineData as SimpleUploadData;
    // Simple ma smoothProgress lub obliczamy z bytes
    if (
      simpleData.smoothProgress !== undefined &&
      !Number.isNaN(simpleData.smoothProgress)
    ) {
      return simpleData.smoothProgress;
    }
    return upload.progress;
  }

  getSpeed(upload: UnifiedUploadState): string {
    const simpleData = upload.engineData as SimpleUploadData;
    if (
      simpleData.speedMbps &&
      isFinite(simpleData.speedMbps) &&
      simpleData.speedMbps > 0
    ) {
      return `${(simpleData.speedMbps / 8).toFixed(2)} MB/s`;
    }
    return "—";
  }

  getETA(upload: UnifiedUploadState): string {
    if (upload.etaSec && isFinite(upload.etaSec) && upload.etaSec > 0) {
      if (upload.etaSec < 60) return `${Math.round(upload.etaSec)}s`;
      if (upload.etaSec < 3600) return `${Math.round(upload.etaSec / 60)}min`;
      return `${Math.round(upload.etaSec / 3600)}h`;
    }
    return "—";
  }

  getStatus(upload: UnifiedUploadState): string {
    switch (upload.status) {
      case "queued":
        return `W kolejce (${upload.queuePosition || 0})`;
      case "uploading":
        return "Wysyłanie...";
      case "paused":
        return "Wstrzymane";
      case "completed":
        return "Zakończone";
      case "error":
        return "Błąd";
      case "canceled":
        return "Anulowane";
      default:
        return "W kolejce";
    }
  }

  canPause(upload: UnifiedUploadState): boolean {
    return upload.status === "uploading";
  }

  canResume(upload: UnifiedUploadState): boolean {
    return upload.status === "paused";
  }

  canCancel(upload: UnifiedUploadState): boolean {
    return ["uploading", "queued", "paused"].includes(upload.status);
  }

  async pause(upload: UnifiedUploadState): Promise<void> {
    this.uploadContext.pause(upload.id);
  }

  async resume(upload: UnifiedUploadState): Promise<void> {
    this.uploadContext.resume(upload.id);
  }

  async cancel(upload: UnifiedUploadState): Promise<void> {
    this.uploadContext.cancel(upload.id);
  }

  async remove(upload: UnifiedUploadState): Promise<void> {
    this.uploadContext.remove(upload.id);
  }
}

// Factory function do tworzenia odpowiedniego adaptera
export function createUploadEngineAdapter(
  engine: "uppy" | "simple",
  uploadContext?: UploadContextValue
): UploadEngineAdapter {
  switch (engine) {
    case "uppy":
      return new UppyEngineAdapter();
    case "simple":
      if (!uploadContext) {
        throw new Error("SimpleEngineAdapter wymaga uploadContext");
      }
      return new SimpleEngineAdapter(uploadContext);
    default:
      throw new Error(`Nieznany engine: ${engine}`);
  }
}
